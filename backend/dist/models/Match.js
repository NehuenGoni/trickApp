"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importStar(require("mongoose"));
const constants_1 = require("../config/constants");
const MatchSchema = new mongoose_1.Schema({
    tournament: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: "Tournament",
        required: false
    },
    teams: [
        {
            teamId: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "User" },
            score: { type: Number, default: 0 },
            players: [
                {
                    playerId: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "User" },
                    username: { type: String, required: false },
                    isGuest: { type: Boolean, default: false }
                }
            ]
        }
    ],
    winner: { type: mongoose_1.Schema.Types.ObjectId, ref: "User", required: false },
    status: {
        type: String,
        enum: Object.values(constants_1.MATCH_STATUS),
        default: constants_1.MATCH_STATUS.IN_PROGRESS
    },
    type: {
        type: String,
        enum: Object.values(constants_1.MATCH_TYPES),
        default: constants_1.MATCH_TYPES.FRIENDLY
    },
    phase: {
        type: String,
        enum: ["group", "quarter-finals", "semi-finals", "final"],
        required: false
    },
    createdAt: { type: Date, default: Date.now },
}, { collection: "matches", timestamps: true });
const Match = mongoose_1.default.model("Match", MatchSchema, "matches");
exports.default = Match;
