import express, {Request, Response} from "express";
import { registerUser, loginUser } from "../controllers/auth.controller"
import authMiddleware from "../middlewares/authMiddleware";
import User from "../models/User";
import bcrypt from "bcryptjs";

const router = express.Router();

interface AuthRequest extends Request {
  user?: any;
}

router.post("/register", registerUser);
router.post("/login", loginUser);

router.get("/profile", authMiddleware, async (req: AuthRequest & { user?: any }, res: Response) => {
    try {
        const user = await User.findById(req.user).select("-password")
        if (!user) {
            res.status(404).json({ message: "Usuario no encontrado" });
            return
        }
        res.json({ user });
    } catch (error) {
        res.status(500).json({ message: "Error al obtener el perfil", error });
    }
});

router.put("/profile", authMiddleware, async (req: AuthRequest, res: Response) => {
    const { username, currentPassword, newPassword } = req.body;

    try {
      const user = await User.findById(req.user);
        if (!user) {
            res.status(404).json({ message: "Usuario no encontrado" });
            return 
        }

        if (username && !newPassword) {
            user.username = username;
            await user.save();
            res.json({ message: "Nombre de usuario actualizado correctamente" });
            return 
        }

        if (newPassword) {
            const isMatch = await bcrypt.compare(currentPassword, user.password);
            if (!isMatch) {
                res.status(400).json({ message: "La contraseña actual es incorrecta" });
                return 
            }
            user.password = newPassword;
            if (username) user.username = username;
            await user.save();
            res.json({ message: "Perfil actualizado correctamente" });
            return 
        }
    } catch (error) {
        res.status(500).json({ message: "Error al actualizar el perfil", error });
    }
});
export default router;

