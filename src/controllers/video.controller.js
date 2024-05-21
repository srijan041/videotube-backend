import mongoose, { isValidObjectId } from "mongoose";
import { Video } from "../models/video.model.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";

const getAllVideos = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, query, sortBy, sortType, userId } = req.query;

    if (!isValidObjectId(userId)) {
        throw new ApiError(400, "Invalid user id");
    }

    const pipeline = [];

    if (query) {
        pipeline.push({
            $search: {
                index: "search-videos",
                text: {
                    query,
                    //TODO: Add path to title and description by adding field mapping in mongoDB
                },
            },
        });
    }

    if (userId) {
        if (!isValidObjectId(userId)) {
            throw new ApiError(400, "Invalid user id");
        }

        pipeline.push({
            $match: {
                owner: mongoose.Types.ObjectId(userId),
            },
        });
    }

    // fetch videos only that are set isPublished as true
    pipeline.push({
        $match: { isPublished: true },
    });

    //sortBy can be views, createdAt, duration
    //sortType can be ascending(-1) or descending(1)

    if (sortBy && sortType) {
        pipeline.push({
            $sort: {
                [sortBy]: sortType === "asc" ? 1 : -1,
            },
        });
    } else {
        pipeline.push({
            $sort: {
                createdAt: -1,
            },
        });
    }

    pipeline.push(
        {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "ownerDetails",
                pipeline: [
                    {
                        $project: {
                            username: 1,
                            "avatar.url": 1,
                        },
                    },
                ],
            },
        },
        {
            $unwind: "$ownerDetails",
        }
    );

    const videoAggregate = Video.aggregate(pipeline);

    const options = {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
    };

    const video = await Video.aggregatePaginate(videoAggregate, options);

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                video,
                "All videos fetched successfully"
            )
        )
});

const publishAVideo = asyncHandler(async (req, res) => {
    const { title, description } = req.body;

    if ([title, description].some((field) => field?.trim() === "")) {
        throw new ApiError(400, "All fields are required");
    }

    const videoFileLocalPath = req.files?.videoFile[0].path;
    const thumbnailLocalPath = req.files?.thumbnail[0].path;

    if (!videoFileLocalPath) {
        throw new ApiError(400, "videoFileLocalPath is required");
    }

    if (!thumbnailLocalPath) {
        throw new ApiError(400, "thumbnailLocalPath is required");
    }

    const videoFile = await uploadOnCloudinary(videoFileLocalPath);
    const thumbnail = await uploadOnCloudinary(thumbnailLocalPath);

    if (!videoFile) {
        //TODO: Delete uploaded files if upload fails
        throw new ApiError(500, "Video file not uploaded");
    }

    if (!thumbnail) {
        //TODO: Delete uploaded files if upload fails

        throw new ApiError(500, "Thumbnail not uploaded");
    }

    const video = await Video.create({
        title,
        description,
        duration: videoFile.duration,
        videoFile: {
            url: videoFile.url,
            public_id: videoFile.public_id,
        },
        thumbnail: {
            url: thumbnail.url,
            public_id: thumbnail.public_id,
        },
        userId: req.user?._id,
        isPublished: false,
    });

    const videoUploaded = await Video.findById(video._id);

    if (!videoUploaded) {
        throw new ApiError(500, "Video not uploaded. Try again");
    }

    return res
        .status(200)
        .json(new ApiResponse(200, videoUploaded, "Video uploaded successfully"));
});

const getVideoById = asyncHandler(async (req, res) => {
    const { videoId } = req.params;

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid videoId");
    }

    if (!isValidObjectId(req.user?._id)) {
        throw new ApiError(400, "Invalid userId");
    }

    //TODO: Add aggregation pipeline to destructure and add subscribers, likes, comments owner, and etc details
    const video = await Video.findById(videoId);

    if (!video) {
        throw new ApiError(500, "Video not found");
    }

    await Video.findByIdAndUpdate(videoId, {
        $inc: {
            views: 1
        }
    });

    await User.findByIdAndUpdate(req.user?._id, {
        $addToSet: {
            watchHistory: videoId
        }
    });

    return res
        .status(200)
        .json(new ApiResponse(200, video[0], "Video details fetched successfully"));
});

const updateVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params;
    const { title, description } = req.body;

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid videoId");
    }

    if (!(title && description)) {
        throw new ApiError(400, "Title and Description are required");
    }

    const video = await Video.findById(videoId);

    if (!video) {
        throw new ApiError(500, "Video not found");
    }

    if (video.owner.toString() !== req.user?._id.toString()) {
        throw new ApiError(401, "Unauthorized Access");
    }

    //deleting old thumbnail and updating with new one
    const thumbnailToDelete = video.thumbnail.public_id;

    const thumbnailLocalPath = req.file?.path;

    if (!thumbnailLocalPath) {
        throw new ApiError(400, "thumbnail is required");
    }

    const thumbnail = await uploadOnCloudinary(thumbnailLocalPath);

    if (!thumbnail) {
        throw new ApiError(500, "thumbnail failed to upload");
    }

    const updatedVideo = await Video.findByIdAndUpdate(
        videoId,
        {
            $set: {
                title,
                description,
                thumbnail: {
                    url: thumbnail.url,
                    public_id: thumbnail.public_id,
                },
            },
        },
        { new: true }
    );

    if (!updatedVideo)
        throw new ApiError(500, "Failed to update video. Try again");

    //TODO: delete old thumbnail
    // await deleteOnCloudinary(thumbnailToDelete);

    return res
        .status(200)
        .json(new ApiResponse(200, updatedVideo, "Video updated successfully"));
});

const deleteVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params;

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid videoId");
    }

    const video = await Video.findById(videoId);

    if (!video) {
        throw new ApiError(404, "Video not found");
    }

    if (video.owner.toString() !== req.user?._id.toString()) {
        throw new ApiError(401, "Unauthorized Access");
    }

    const videoDeleted = await Video.findByIdAndDelete(video?._id);

    if (!videoDeleted) throw new ApiError(500, "Failed to delete the video");

    // TODO: Delete files from cloudinary

    // TODO: delete likes

    // TODO: Delete comments

    return res
        .status(200)
        .json(new ApiResponse(200, videoDeleted, "Video deleted successfully"));
});

const togglePublishStatus = asyncHandler(async (req, res) => {
    const { videoId } = req.params;

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid videoId");
    }

    const video = await Video.findById(videoId);

    if (!video) {
        throw new ApiError(404, "Video not found");
    }

    if (!video.owner.toString() === req.user?._id.toString()) {
        throw new ApiError(401, "Unauthorized Access");
    }

    const toggle = await Video.findByIdAndUpdate(
        videoId,
        {
            $set: {
                isPublished: !video.isPublished,
            },
        },
        { new: true }
    );

    if (!toggle) {
        throw new ApiError(500, "Failed to toggle publish status");
    }

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                { isPublished: toggle.isPublished },
                "Publish status toggled successfully"
            )
        );
});

export {
    getAllVideos,
    publishAVideo,
    getVideoById,
    updateVideo,
    deleteVideo,
    togglePublishStatus,
};
