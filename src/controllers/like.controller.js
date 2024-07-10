import mongoose, { isValidObjectId } from "mongoose"
import { Like } from "../models/like.model.js"
import { ApiError } from "../utils/ApiError.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import { asyncHandler } from "../utils/asyncHandler.js"
import { Video } from "../models/video.model.js"

const toggleVideoLike = asyncHandler(async (req, res) => {
    const { videoId } = req.params

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid videoId");
    }

    const video = await Video.findById(videoId);
    if (!video) {
        throw new ApiError(500, "Video not found");
    }

    const like = await Like.findOne({ likedBy: req.user?._id, video: videoId })

    if (like) {
        await Like.findOneAndDelete(like?._id)

        return res
            .status(200)
            .json(new ApiResponse(200, { isLiked: false }, "Video unliked successfully"));
    }

    const newLike = await Like.create({ likedBy: req.user?._id, video: videoId })

    if (!newLike) {
        throw new ApiError(500, "Like not created. Try again");
    }

    return res
        .status(200)
        .json(new ApiResponse(200, { isLiked: true, like: newLike }, "Video liked successfully"))
})

const toggleCommentLike = asyncHandler(async (req, res) => {
    const { commentId } = req.params

    if (!isValidObjectId(commentId)) {
        throw new ApiError(400, "Invalid commentId");
    }

    const comment = await Comment.findById(commentId);
    if (!comment) {
        throw new ApiError(500, "Comment not found");
    }

    const like = await Like.findOne({ likedBy: req.user?._id, comment: commentId })

    if (like) {
        await Like.findOneAndDelete(like?._id)

        return res
            .status(200)
            .json(new ApiResponse(200, { isLiked: false }, "Comment unliked successfully"));
    }

    const newLike = await Like.create({ likedBy: req.user?._id, comment: commentId })

    if (!newLike) {
        throw new ApiError(500, "Like not created. Try again");
    }

    return res
        .status(200)
        .json(new ApiResponse(200, { isLiked: true, like: newLike }, "Comment liked successfully"))

})

const toggleTweetLike = asyncHandler(async (req, res) => {
    const { tweetId } = req.params

    if (!isValidObjectId(tweetId)) {
        throw new ApiError(400, "Invalid tweetId");
    }

    const tweet = await Tweet.findById(tweetId);
    if (!tweet) {
        throw new ApiError(500, "Tweet not found");
    }

    const like = await Like.findOne({ likedBy: req.user?._id, tweet: tweetId })

    if (like) {
        await Like.findOneAndDelete(like?._id)

        return res
            .status(200)
            .json(new ApiResponse(200, { isLiked: false }, "Tweet unliked successfully"));
    }

    const newlike = await Like.create({ likedBy: req.user?._id, tweet: tweetId })

    if (!newlike) {
        throw new ApiError(500, "Like not created. Try again");
    }

    return res
        .status(200)
        .json(new ApiResponse(200, { isLiked: true, like: newlike }, "Tweet liked successfully"))

}
)

const getLikedVideos = asyncHandler(async (req, res) => {

    const likedVideosAggegate = await Like.aggregate([
        {
            $match: {
                likedBy: new mongoose.Types.ObjectId(req.user?._id),
            },
        },
        {
            $lookup: {
                from: "videos",
                localField: "video",
                foreignField: "_id",
                as: "likedVideo",
                pipeline: [
                    {
                        $lookup: {
                            from: "users",
                            localField: "owner",
                            foreignField: "_id",
                            as: "ownerDetails",
                        },
                    },
                    {
                        $unwind: "$ownerDetails",
                    },
                ],
            },
        },
        {
            $unwind: "$likedVideo",
        },
        {
            $sort: {
                createdAt: -1,
            },
        },
        {
            $project: {
                _id: 0,
                likedVideo: {
                    _id: 1,
                    "videoFile.url": 1,
                    "thumbnail.url": 1,
                    owner: 1,
                    title: 1,
                    description: 1,
                    views: 1,
                    duration: 1,
                    createdAt: 1,
                    isPublished: 1,
                    ownerDetails: {
                        username: 1,
                        fullName: 1,
                        "avatar.url": 1,
                    },
                },
            },
        },
    ]);

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                likedVideosAggegate,
                "Liked videos fetched successfully"
            )
        );
})

export {
    toggleCommentLike,
    toggleTweetLike,
    toggleVideoLike,
    getLikedVideos
}