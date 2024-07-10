import mongoose, { isValidObjectId } from "mongoose"
import { Playlist } from "../models/playlist.model.js"
import { Video } from "../models/video.model.js"
import { ApiError } from "../utils/ApiError.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import { asyncHandler } from "../utils/asyncHandler.js"


const createPlaylist = asyncHandler(async (req, res) => {
    const { name, description } = req.body

    // console.table({name, description})

    if ([name, description].some((field) => field?.trim() === ""))
        throw new ApiError(400, "All fields are required")

    const playlist = await Playlist.create({
        name,
        description,
        owner: req.user?._id,
    })

    if (!playlist)
        throw new ApiError(500, "Playlist not created")

    return res
        .status(200)
        .json(new ApiResponse(200, playlist, "Playlist created successfully"))

})

const getUserPlaylists = asyncHandler(async (req, res) => {
    const { userId } = req.params


    if (!isValidObjectId(userId))
        throw new ApiError(400, "Invalid user id")

    const playlists = await Playlist.aggregate([
        {
            $match: {
                owner: new mongoose.Types.ObjectId(userId)
            }
        },
        {
            $lookup: {
                from: "playlists",
                localField: "owner",
                foreignField: "_id",
                as: "playlists"
            }
        },
        {
            $addFields: {
                totalVideos: {
                    $size: "$playlists"
                }
            }
        },
        {
            $project: {
                _id: 1,
                name: 1,
                description: 1,
                totalVideos: 1,
                // totalViews: 1,
                updatedAt: 1
            }
        }

    ])

    return res
        .status(200)
        .json(new ApiResponse(200, playlists, "User playlists fetched successfully"))
})

const getPlaylistById = asyncHandler(async (req, res) => {
    const { playlistId } = req.params

    if (!isValidObjectId(playlistId))
        throw new ApiError(400, "Invalid playlist id")

    const playlist = await Playlist.findById(playlistId)

    if (!playlist)
        throw new ApiError(500, "Playlist not found")

    return res
        .status(200)
        .json(new ApiResponse(200, playlist, "Playlist fetched successfully"))
})

const addVideoToPlaylist = asyncHandler(async (req, res) => {
    const { playlistId, videoId } = req.params


    if (!isValidObjectId(playlistId) || !isValidObjectId(videoId))
        throw new ApiError(400, "Invalid playlist or video id")


    const playlist = await Playlist.findById(playlistId)
    if (!playlist)
        throw new ApiError(500, "Playlist not found")

    if(playlist.owner.toString() !== req.user?._id.toString())
        throw new ApiError(500, "You are not authorized to perform this action")


    const video = await Video.findById(videoId)
    if (!video)
        throw new ApiError(500, "Video not found")


    // add video if its not present in playlist
    if(!playlist.video.includes(videoId)){

        await Playlist.findByIdAndUpdate(playlistId, {
            $push: {
                video: videoId
            }
        })
    }

    else
        throw new ApiError(500, "Video already present in playlist")

    
    return res
            .status(200)
            .json(new ApiResponse(200, {}, "Video added to playlist successfully"))

})

const removeVideoFromPlaylist = asyncHandler(async (req, res) => {
    const { playlistId, videoId } = req.params
    // TODO: remove video from playlist

    if (!isValidObjectId(playlistId) || !isValidObjectId(videoId))
        throw new ApiError(400, "Invalid playlist or video id")

    const playlist = await Playlist.findById(playlistId)
    if (!playlist)
        throw new ApiError(500, "Playlist not found")

    if(playlist.owner.toString() !== req.user?._id.toString())
        throw new ApiError(500, "You are not authorized to perform this action")


    const video = await Video.findById(videoId)
    if (!video)
        throw new ApiError(500, "Video not found")

    if(playlist.video.includes(videoId)){
        await Playlist.findByIdAndUpdate(playlistId, {
            $pull: {
                video: videoId
            }
        })
    }
    else
        throw new ApiError(500, "Video not present in playlist")


    return res
            .status(200)
            .json(new ApiResponse(200, {}, "Video removed from playlist successfully"))

})

const deletePlaylist = asyncHandler(async (req, res) => {
    const { playlistId } = req.params
    // TODO: delete playlist
})

const updatePlaylist = asyncHandler(async (req, res) => {
    const { playlistId } = req.params
    const { name, description } = req.body
    //TODO: update playlist
})

export {
    createPlaylist,
    getUserPlaylists,
    getPlaylistById,
    addVideoToPlaylist,
    removeVideoFromPlaylist,
    deletePlaylist,
    updatePlaylist
}