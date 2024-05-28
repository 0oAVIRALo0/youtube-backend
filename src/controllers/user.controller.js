import { asyncHandler } from "../utils/asyncHandler.js";
import { errorHandler } from "../utils/errorHandler.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { responseHandler } from "../utils/responseHandler.js";
import jwt from "jsonwebtoken";

const generateAccessAndRefreshToken = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ ValidateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    throw new errorHandler(
      500,
      "Something went wrong while generating referesh and access token"
    );
  }
};

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

const loginUser = asyncHandler(async (req, res) => {
  // req body -> data
  // username or email
  //find the user
  //password check
  //access and referesh token
  //send cookie

  const { username, email, password } = req.body;

  if (!username || !email) {
    throw new errorHandler(400, "User or email is required.");
  }

  const user = await User.findOne({
    $or: [{ email }, { username }],
  });

  if (!user) {
    throw new errorHandler(404, "User does not exist");
  }

  const isPasswordValid = await user.isPasswordCorrect(password);

  if (!isPasswordValid) {
    throw new errorHandler(401, "Invalid user credentials");
  }

  const { accessToken, refreshToken } = generateAccessAndRefreshToken(user._id);

  const loggedInUser = User.findById(user._id).select(
    "-password -refreshToken"
  );

  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new responseHandler(
        200,
        {
          user: loggedInUser,
          accessToken,
          refreshToken,
        },
        "User logged in successfuly"
      )
    );
});

const logoutUser = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  await User.findByIdAndUpdate(
    userId,
    {
      $unset: {
        refreshToken: 1,
      },
    },
    { new: true }
  );

  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new responseHandler(200, {}, "User logged out successfully"));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken =
    req.cookies.refreshToken || req.body.refreshToken;

  if (!incomingRefreshToken) {
    throw new errorHandler(401, "Unauthorized request");
  }

  try {
    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );

    const userId = decodedToken._id;
    const user = User.findById(userId);

    if (!user) {
      throw new errorHandler(401, "Invalid refresh token");
    }

    if (incomingRefreshToken !== user?.refreshToken) {
      throw new errorHandler(401, "Refresh token is expired or used");
    }

    const options = {
      httpOnly: true,
      secure: true,
    };

    const { accessToken, refreshToken } = generateAccessAndRefreshToken(
      user._id
    );

    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", refreshToken, options)
      .json(
        new responseHandler(
          200,
          { accessToken: accessToken, refreshToken: refreshToken },
          "Access token refreshed"
        )
      );
  } catch (error) {
    throw new errorHandler(401, error?.message || "Invaluid refresh token");
  }
});

const changeCurrentPassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  const userId = req.user._id;
  const user = await User.findById(userId);

  const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);

  if (!isPasswordCorrect) {
    throw new errorHandler(400, "Invalid old password");
  }

  user.password = newPassword;
  await user.save({ ValidateBeforeSave: false });

  return res
    .status(200)
    .json(new responseHandler(200, {}, "Password changes successfully"));
});

const getCurrectUser = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(new responseHandler(200, req.user, "User fetched successfully"));
});

const updateAccountDetails = asyncHandler(async (req, res) => {
  const { fullName, email } = req.body;

  if (!fullName || !email) {
    throw new errorHandler(400, "All fields are required");
  }

  const userId = req.user._id;

  const user = await User.findByIdAndUpdate(
    userId,
    {
      $set: {
        fullName: fullName,
        email: email,
      },
    },
    { new: true }
  ).select("-password");

  return res
    .status(200)
    .json(
      new responseHandler(200, user, "Account details updated successfully")
    );
});

const updateUserAvatar = asyncHandler(async (ewq, res) => {
  const avatarLocalPath = req.files?.path;

  if (!avatarLocalPath) {
    throw new errorHandler(400, "Avatar file is missing");
  }

  const avatar = await uploadOnCloudinary(avatarLocalPath);

  if (!avatar.url) {
    throw new errorHandler(400, "Error while uplaoding on server.");
  }

  const userId = req.user._id;
  const user = await User.findByIdAndUpdate(
    userId,
    { $set: { avatar: avatar.url } },
    { new: true }
  ).select("-password");

  return res
    .status(200)
    .json(new responseHandler(200, user, "Avatar image updated successfuly"));
});

const updateUserCoverImage = asyncHandler(async (ewq, res) => {
  const coverImageLocalPath = req.files?.path;

  if (!coverImageLocalPath) {
    throw new errorHandler(400, "Avatar file is missing");
  }

  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  if (!coverImage.url) {
    throw new errorHandler(400, "Error while uplaoding on server.");
  }

  const userId = req.user._id;
  const user = await User.findByIdAndUpdate(
    userId,
    { $set: { coverImage: coverImage.url } },
    { new: true }
  ).select("-password");

  return res
    .status(200)
    .json(new responseHandler(200, user, "Cover image updated successfuly"));
});

export {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  changeCurrentPassword,
  getCurrectUser,
  updateAccountDetails,
  updateUserAvatar,
  updateUserCoverImage,
};
