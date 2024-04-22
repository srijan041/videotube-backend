import mongoose, { isValidObjectId } from "mongoose"
import { User } from "../models/user.model.js"
import { Subscription } from "../models/subscription.model.js"
import { ApiError } from "../utils/ApiError.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import { asyncHandler } from "../utils/asyncHandler.js"


const toggleSubscription = asyncHandler(async (req, res) => {

    const { channelId } = req.params


    if (!isValidObjectId(channelId)) {
        throw new ApiError(400, "Invalid channelId");
    }

    const subsciption = await Subscription.findOne({
        $and: [{ subscriber: req.user?._id }, { channel: channelId }]

        // subscriber: req.user?._id,
        // channel: channelId
    })

    // console.log(subsciption);

    if (!subsciption) {
        //create a new subscription
        const new_subscription = await Subscription.create({
            subscriber: req.user?._id,
            channel: channelId,
        })

        return res
            .status(200)
            .json(
                new ApiResponse(
                    200,
                    new_subscription,
                    `subscribed successfully`
                )
            )
    } else {
        //delete a subscription
        const deletedSubscription = await Subscription.findByIdAndDelete(subsciption._id)

        return res
            .status(200)
            .json(
                new ApiResponse(
                    200,
                    deletedSubscription,
                    ` unsubscribed successfully`
                )
            )
    }

})

// controller to return subscriber list of a channel
const getUserChannelSubscribers = asyncHandler(async (req, res) => {
    const { channelId } = req.params

    if (!isValidObjectId(channelId)) {
        throw new ApiError(400, "Invalid channelId");
    }


    //TODO: Add aggregation pipeline to destructure and add subscribers details
    const subscribers = await Subscription.find({
        channel: channelId,
    })

    console.log(subscribers);

    if (!subscribers)
        throw new ApiError(500, "Unable to fetch subscribers")

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                subscribers,
                "Fetched all subscribers successfully"
            )
        )

})

// controller to return channel list to which user has subscribed
const getSubscribedChannels = asyncHandler(async (req, res) => {
    const { subscriberId } = req.params

    if (!isValidObjectId(subscriberId))
        throw new ApiError(400, "invalid subscribeId")


    // TODO: Add pipeline to destructure channels found
    const subscribedTo = await Subscription.find({
        subscriber: subscriberId
    })

    if (!subscribedTo)
        throw new ApiError(500, "SubscribedTo not found")

    return res
        .status(200)
        .json(new ApiResponse(
            200,
            subscribedTo,
            "Subscribed to channels fetched successfully"
        ))
})

export {
    toggleSubscription,
    getUserChannelSubscribers,
    getSubscribedChannels
}