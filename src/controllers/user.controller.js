import { asyncHandler } from "../utils/asyncHandler.js";
import { errorHandler } from "../utils/errorHandler.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { responseHandler } from "../utils/responseHandler.js";

const registerUser = asyncHandler(async (req, res) => {
  // get user details from frontend
  // validation - not empty
  // check if user already exists: username, email
  // check for images, check for avatar
  // upload them to cloudinary, avatar
  // create user object - create entry in db
  // remove password and refresh token field from response
  // check for user creation
  // return res

  console.log(req.body);

  const { fullName, username, email, password } = req.body;

  if (!fullName || !username || !email || !password) {
    throw new errorHandler(400, "All fields are required");
  }

  const existedUser = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (existedUser) {
    throw new errorHandler(409, "User with email or username already exists.");
  }

  console.log("files: ", req.files);

  const avatarLocalpath = req.files?.avatar[0]?.path;
  console.log(avatarLocalpath);

  let coverImageLocalpath;
  if (
    req.files &&
    Array.isArray(req.files.coverImage) &&
    req.files.coverImage.length > 0
  ) {
    coverImageLocalpath = req.files.coverImage[0].path;
  }

  console.log(coverImageLocalpath);

  if (!avatarLocalpath) {
    throw new errorHandler(400, "Avatar file is required");
  }

  const avatar = await uploadOnCloudinary(avatarLocalpath);
  const coverImage = await uploadOnCloudinary(coverImageLocalpath);

  console.log(avatar);

  if (!avatar.url) {
    throw new errorHandler(400, "Avatar file is required");
  }

  const user = await User.create({
    fullName: fullName,
    username: username.toLowerCase(),
    email: email,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
    password: password,
  });

  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  if (!createdUser) {
    throw new errorHandler(
      500,
      "Something went wrong while registering the user"
    );
  }

  return res
    .status(201)
    .json(
      new responseHandler(200, createdUser, "User registered successfully.")
    );
});

export { registerUser };
