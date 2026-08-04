"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const constants_1 = require("../config/constants");
const tournamentLogoSchema = new mongoose_1.Schema({
    tournamentId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "Tournament",
        required: true,
        unique: true,
        index: true
    },
    data: { type: Buffer, required: true },
    mimeType: {
        type: String,
        enum: constants_1.ALLOWED_LOGO_MIME_TYPES,
        required: true
    },
    size: { type: Number, required: true },
    /** Hash corto del buffer. Se usa como cache buster en la URL (`?v=`). */
    version: { type: String, required: true }
}, { collection: "tournamentlogos", timestamps: true });
const TournamentLogoModel = (0, mongoose_1.model)("TournamentLogo", tournamentLogoSchema);
exports.default = TournamentLogoModel;
