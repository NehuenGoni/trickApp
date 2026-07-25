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
const PlayerSchema = new mongoose_1.Schema({
    playerId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "User",
        required: function () {
            return !this.isGuest;
        }
    },
    name: { type: String, required: false },
    isGuest: { type: Boolean, default: false }
});
const TeamSchema = new mongoose_1.Schema({
    teamId: { type: mongoose_1.Schema.Types.ObjectId, auto: true },
    name: { type: String, required: true },
    registeredBy: { type: mongoose_1.Schema.Types.ObjectId, ref: "User", required: false },
    players: { type: [PlayerSchema], required: true },
    isDrawn: { type: Boolean, default: false },
});
const IndividualSignupSchema = new mongoose_1.Schema({
    signupId: { type: mongoose_1.Schema.Types.ObjectId, auto: true },
    userId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "User",
        required: function () { return !this.isGuest; }
    },
    name: { type: String, required: true },
    isGuest: { type: Boolean, default: false }
}, { _id: false });
const PlayerStatSchema = new mongoose_1.Schema({
    playerId: { type: mongoose_1.Schema.Types.ObjectId, ref: "User", required: false },
    name: { type: String, required: true },
    isGuest: { type: Boolean, default: false },
    position: { type: Number, required: true, min: 1, max: 8 },
    points: { type: Number, required: true, min: 0 }
}, { _id: false });
const tournamentSchema = new mongoose_1.Schema({
    name: { type: String, required: true },
    createdBy: { type: mongoose_1.Schema.Types.ObjectId, ref: "User", required: true },
    type: {
        type: String,
        enum: Object.values(constants_1.TOURNAMENT_TYPES),
        required: true,
        default: constants_1.TOURNAMENT_TYPES.MASTER_1000
    },
    format: {
        type: String,
        enum: Object.values(constants_1.TOURNAMENT_FORMATS),
        required: true,
        default: constants_1.TOURNAMENT_FORMATS.DUOS
    },
    teamFormationMode: {
        type: String,
        enum: Object.values(constants_1.TEAM_FORMATION_MODES),
        required: true,
        default: constants_1.TEAM_FORMATION_MODES.USER_FORMED
    },
    teams: { type: [TeamSchema], default: [] },
    individualSignups: { type: [IndividualSignupSchema], default: [] },
    draftPairOrder: { type: [mongoose_1.Schema.Types.ObjectId], default: undefined },
    startDate: { type: Date, required: true },
    description: { type: String },
    matches: [{ type: mongoose_1.default.Schema.Types.ObjectId, ref: "Match" }],
    playerStats: { type: [PlayerStatSchema], default: [] },
    pointsAwarded: { type: Boolean, default: false },
    status: {
        type: String,
        enum: ['upcoming', 'in_progress', 'completed'],
        default: 'upcoming'
    },
    createdAt: { type: Date, default: Date.now },
}, { collection: "tournaments", timestamps: true });
const TournamentModel = (0, mongoose_1.model)("Tournament", tournamentSchema);
exports.default = TournamentModel;
