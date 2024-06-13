import jwt from "jsonwebtoken";
import { asyncHandler } from "../utils/asyncHandler.js";
import { errorHandler } from "../utils/errorHandler.js";
import { User } from "../models/user.model.js";

const verifyJWT = asyncHandler(async (req, res) => {
  try {
    const token =
      req.cookies?.accessToken ||
      req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      throw new errorHandler(401, "Unauthorized request");
    }

    const decodedToken = jwt.decode(token, process.env.ACCESS_TOKEN_SECRET);

    const userId = decodedToken?._id;

    const user = await User.findById(userId).select("-password refreshToken");

    if (!user) {
      throw new errorHandler(401, "Invalid access token");
    }

    req.user = user;
    next();
  } catch (error) {
    throw new errorHandler(401, error?.message || "Invalid access token");
  }
});

export { verifyJWT };
