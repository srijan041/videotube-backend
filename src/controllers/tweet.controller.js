import mongoose, { isValidObjectId } from "mongoose"
import { Tweet } from "../models/tweet.model.js"
import { User } from "../models/user.model.js"
import { ApiError } from "../utils/ApiError.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import { asyncHandler } from "../utils/asyncHandler.js"

const createTweet = asyncHandler(async (req, res) => {
    const { content } = req.body

    if (!content)
        throw new ApiError(400, "Content is required")

    const tweet = await Tweet.create(
        {
            content,
            owner: req.user._id,
        }
    )

    if (!tweet)
        throw new ApiError(500, "Failed to create tweet. Try again")

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                tweet,
                "tweeted successfully"
            )
        )

})

const getUserTweets = asyncHandler(async (req, res) => {
    const { userId } = req.params

    if (!userId)
        throw new ApiError(400, "username required")

    const user = await User.findOne({ userId })

    if (!user)
        throw new ApiError(404, "User does not exist")


    const tweets = await Tweet.aggregate([
        {
            $match: {
                owner: new mongoose.Types.ObjectId(userId),
            },
        },
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
            $lookup: {
                from: "likes",
                localField: "_id",
                foreignField: "tweet",
                as: "likeDetails",
                pipeline: [
                    {
                        $project: {
                            likedBy: 1,
                        },
                    },
                ],
            },
        },
        {
            $addFields: {
                likesCount: {
                    $size: "$likeDetails",
                },
                ownerDetails: {
                    $first: "$ownerDetails",
                },
                isLiked: {
                    $cond: {
                        if: { $in: [req.user?._id, "$likeDetails.likedBy"] },
                        then: true,
                        else: false
                    }
                }
            },
        },
        {
            $sort: {
                createdAt: -1
            }
        },
        {
            $project: {
                content: 1,
                ownerDetails: 1,
                likesCount: 1,
                createdAt: 1,
                isLiked: 1
            },
        },
    ])

    if (!tweets)
        throw new ApiError(500, "Tweets not found")

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                tweets,
                `All tweets by user '${username}' fetched.`
            )
        )



})

const updateTweet = asyncHandler(async (req, res) => {

    const { tweetId } = req.params
    const { content } = req.body

    if (!content)
        throw new ApiError(400, "Content is required")

    if (!isValidObjectId(tweetId)) {
        throw new ApiError(400, "Invalid tweetId");
    }

    const tweet = await Tweet.findById(tweetId)

    if (!tweet) {
        throw new ApiError(404, "tweetid not found")
    }

    if (!(tweet?.owner.equals(req.user?._id)))
        throw new ApiError(400, "Unauthorised to edit. Must be logged in.")

    const new_tweet = await Tweet.findByIdAndUpdate(
        tweetId,
        {
            $set: {
                content,
            }
        },
        { new: true },
    )

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                new_tweet,
                "Tweet updated successfully",
            )
        )
})

const deleteTweet = asyncHandler(async (req, res) => {

    const { tweetId } = req.params

    if (!isValidObjectId(tweetId)) {
        throw new ApiError(400, "Invalid tweetId");
    }

    const tweet = await Tweet.findById(tweetId)

    if (!tweet) {
        throw new ApiError(404, "tweetid not found")
    }

    if (!(tweet?.owner.equals(req.user?._id)))
        throw new ApiError(400, "Unauthorised to edit. Must be logged in.")

    const deletedTweet = await Tweet.findByIdAndDelete(tweetId)

    return res
        .status(200)
        .json(new ApiResponse(
            200,
            deletedTweet,
            "Tweet deleted successfully"
        ))

})

export {
    createTweet,
    getUserTweets,
    updateTweet,
    deleteTweet
}