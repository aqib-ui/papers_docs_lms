const dbConnection = require('../db-connection');
const uploadChapters = require('../middleware/chapter-image-upload-middleware')
const path = require('path');
const fs = require('fs').promises;
const { promisify } = require('util')
const unlinkAsync = promisify(fs.unlink)
const multer = require("multer");


exports.createChapter = async (req, res) => {
    try {
        await uploadChapters(req, res);
        let chapterImageUrl = "";
        if (req.file) {
            chapterImageUrl = '/resources/static/assets/uploads/chapterImageUpload/' + req.file.filename;
        }

        const { course_type, chapter_name } = req.body;
        if (!chapter_name || chapter_name === "") {
            if (req.file) removeUploadedFile(req.file.path);
            return res.status(400).json({
                message: "Chapter name is required"
            });
        }

        const [checkExistence] = await dbConnection.execute(`SELECT * FROM chapters WHERE chapter_name = ?`, [chapter_name]);
        if (checkExistence.length > 0) {
            if (req.file) removeUploadedFile(req.file.path);
            return res.status(400).json({ message: "Chapter already exists" });
        }

        const [createChapter] = await dbConnection.execute("INSERT INTO chapters (course_type, chapter_name, chapter_image_url) VALUES (?, ?, ?)", [course_type, chapter_name, chapterImageUrl]);

        if (createChapter.affectedRows === 1) {
            return res.status(200).send({
                message: "Chapter added successfully"
            });
        } else {
            if (req.file) removeUploadedFile(req.file.path);
            return res.status(500).json({
                message: "Could not add chapter"
            });
        }
    } catch (err) {
        res.status(500).send({
            message: err.message
        });
    }
};

function removeUploadedFile(file) {
    if (file) {
        const filePath = path.join(__dirname, '..', file);
        if (fs.access(filePath)) {
            fs.unlink(filePath);
        }
    }
}

exports.updateChapter = async (req, res) => {
    try {
        uploadChapters(req, res, async (err) => {
            if (err) {
                return res.status(500).send({
                    message: "Failed",
                    data: `Could not process the file: ${err.message}`,
                });
            }

            const { chap_id, course_type, chapter_name } = req.body;
            const [checkExistence] = await dbConnection.execute(`SELECT * FROM chapters WHERE chap_id = ?`, [chap_id]);
            if (checkExistence.length < 1) {
                if (req.file) removeUploadedFile(req.file.path);
                return res.status(400).json({
                    message: "Chapter does not exist"
                });
            }

            let chapterImageUrl = checkExistence[0].chapter_image_url; 
            if (req.file && req.file.originalname) {
                chapterImageUrl = `/resources/static/assets/uploads/chapterImageUpload/${Date.now().toString().slice(0, -3)}-${req.file.originalname}`;

                const oldAttachmentPath = path.join(__dirname, '..', checkExistence[0].chapter_image_url);
                try {
                    await fs.access(oldAttachmentPath);
                    await fs.unlink(oldAttachmentPath);
                } catch (error) {
                    console.error(`Failed to delete old chapter image: ${error.message}`);
                }
            }

            const updateChapterQuery = `UPDATE chapters SET course_type = ?, chapter_name = ?, chapter_image_url = ? WHERE chap_id = ?`;
            const [updateChapter] = await dbConnection.execute(updateChapterQuery, [course_type, chapter_name, chapterImageUrl, chap_id]);

            if (updateChapter.affectedRows === 1) {
                return res.status(200).send({
                    message: "Chapter updated successfully"
                });
            } else {
                if (req.file) removeUploadedFile(req.file.path);
                return res.status(500).json({
                    message: "Could not update chapter"
                });
            }
        });
    } catch (err) {
        res.status(500).send({
            message: err.message
        });
    }
};

exports.deleteChapter = async (req, res) => {
    try {
        const [chapter] = await dbConnection.execute(`SELECT chapter_image_url FROM chapters WHERE chap_id = ?`, [req.body.chap_id]);

        const chapterImageUrl = chapter[0].chapter_image_url;

        if (chapterImageUrl) {
            const imagePath = path.join(__dirname, '..', chapterImageUrl);
            if (fs.access(imagePath)) {
                fs.unlink(imagePath);
            }
        }

        const [deleteChapter] = await dbConnection.execute(`DELETE FROM chapters WHERE chap_id = ?`, [req.body.chap_id]);

        return res.status(200).json({
            message: "Chapter deleted successfully"
        });
    } catch (err) {
        res.status(500).send({
            message: err.message
        });
    }
};

exports.getAllChapters = async (req, res) => {
    try {
        const [getAllChaptersBoth] = await dbConnection.execute(`SELECT * FROM chapters where course_type IN ('OS','AS')`);

        const [getAllChapters] = await dbConnection.execute(`SELECT * FROM chapters where course_type =?`, [req.data.selected_course]);
        return res.status(200).json({
            message: "Chapters retrieved successfully",
            data: req.data.selected_course == "Both" ? getAllChaptersBoth : getAllChapters
        });
    } catch (err) {
        res.status(500).send({
            message: err.message
        });
    }
};

exports.getChapterById = async (req, res) => {
    try {
        const { chap_id } = req.params;
        const [getChapterById] = await dbConnection.execute(`SELECT * FROM chapters where chap_id=?`, [chap_id]);

        return res.status(200).json({
            message: "Chapter retrieved successfully",
            data: getChapterById[0]
        });
    } catch (err) {
        res.status(500).send({
            message: err.message
        });
    }
};

