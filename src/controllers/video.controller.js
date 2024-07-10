import mongoose, { isValidObjectId } from "mongoose";
import { Video } from "../models/video.model.js";
import { User } from "../models/user.model.js";
import { Comment } from "../models/comment.model.js";
import { Like } from "../models/like.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { deleteOnCloudinary, uploadOnCloudinary } from "../utils/cloudinary.js";
import { Playlist } from "../models/playlist.model.js";

const getAllVideos = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, query, sortBy, sortType, userId } = req.query;

    // if (!isValidObjectId(userId)) {
    //     console.log("UserID: ", userId);
    //     throw new ApiError(400, "Invalid user id");
    // }

    //TODO: Check Aggregation Pipeline

    const pipeline = [];

    if (query) {
        pipeline.push({
            $search: {
                index: "search-videos",
                text: {
                    query,
                    //TODO: Add path to title and description by adding field mapping in mongoDB
                    path: ["title", "description"],
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
                owner: new mongoose.Types.ObjectId(userId),
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

    // console.log("videoFileLocalPath", videoFileLocalPath);

    if (!thumbnailLocalPath) {
        throw new ApiError(400, "thumbnailLocalPath is required");
    }

    const videoFile = await uploadOnCloudinary(videoFileLocalPath);
    const thumbnail = await uploadOnCloudinary(thumbnailLocalPath);

   

    if (!videoFile) {
        throw new ApiError(500, "Video file not uploaded");
    }

    if (!thumbnail) {
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
        owner: req.user?._id,
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
    const video = await Video.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(videoId)
            }
        },
        {
            $lookup: {
                from: "likes",
                localField: "_id",
                foreignField: "video",
                as: "likes"
            }
        },
        {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "owner",
                pipeline: [
                    {
                        $lookup: {
                            from: "subscriptions",
                            localField: "_id",
                            foreignField: "channel",
                            as: "subscribers"
                        }
                    },
                    {
                        $addFields: {
                            subscribersCount: {
                                $size: "$subscribers"
                            },
                            isSubscribed: {
                                $cond: {
                                    if: {
                                        $in: [
                                            req.user?._id,
                                            "$subscribers.subscriber"
                                        ]
                                    },
                                    then: true,
                                    else: false
                                }
                            }
                        }
                    },
                    {
                        $project: {
                            username: 1,
                            "avatar.url": 1,
                            subscribersCount: 1,
                            isSubscribed: 1
                        }
                    }
                ]
            }
        },
        {
            $addFields: {
                likesCount: {
                    $size: "$likes"
                },
                owner: {
                    $first: "$owner"
                },
                isLiked: {
                    $cond: {
                        if: {$in: [req.user?._id, "$likes.likedBy"]},
                        then: true,
                        else: false
                    }
                }
            }
        },
        {
            $project: {
                "videoFile.url": 1,
                title: 1,
                description: 1,
                views: 1,
                createdAt: 1,
                duration: 1,
                comments: 1,
                owner: 1,
                likesCount: 1,
                isLiked: 1
            }
        }
    ]);

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


    if(thumbnailToDelete && thumbnailToDelete !== updatedVideo?.thumbnail?.public_id) {
        await deleteOnCloudinary(thumbnailToDelete);
    }

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

    await deleteOnCloudinary(video.thumbnail.public_id);
    await deleteOnCloudinary(video.videoFile.public_id, "video");

    //TODO: check if removed from watch history
    await User.findByIdAndUpdate(req.user?._id, {
        $pull: {
            watchHistory: videoId
        }
    })

    //TODO: check if removed from playlist
    await Playlist.updateMany({
        video: videoId
    }, {
        $pull: {
            video: videoId
        }
    })

    await Like.deleteMany({
        video: videoId,
    })

    await Comment.deleteMany({
        video: videoId,
    })

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

    // console.log(video);

    if (!video) {
        throw new ApiError(404, "Video not found");
    }

    // console.log(video.owner.toString(), req.user?._id.toString());

    if (video.owner.toString() !== req.user?._id.toString()) {
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
