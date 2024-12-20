#include "player.hpp"

namespace msrv {
namespace player_foobar2000 {

PlayerImpl::PlayerImpl()
    : playbackControl_(playback_control::get()),
      playlistManager_(playlist_manager_v4::get()),
      incomingItemFilter_(playlist_incoming_item_filter_v3::get()),
      albumArtManager_(album_art_manager_v3::get()),
      titleFormatCompiler_(titleformat_compiler::get()),
      playlists_(std::make_shared<PlaylistMapping>()),
      playbackOrderOption_(playlistManager_.get_ptr()),
      stopAfterCurrentTrackOption_(playbackControl_.get_ptr())
{
    auto callback = [this](PlayerEvents ev) { emitEvents(ev); };

    playerEventAdapter_.setCallback(callback);
    playlistEventAdapter_.setCallback(callback);
    stopAfterCurrentTrackOption_.setCallback(callback);

    setPlaybackModeOption(&playbackOrderOption_);
    addOption(&playbackOrderOption_);
    addOption(&stopAfterCurrentTrackOption_);
}

PlayerImpl::~PlayerImpl() = default;

std::unique_ptr<WorkQueue> PlayerImpl::createWorkQueue()
{
    return std::make_unique<Fb2kWorkQueue>();
}

boost::unique_future<ArtworkResult> PlayerImpl::fetchCurrentArtwork()
{
    metadb_handle_ptr itemHandle;

    if (playbackControl_->get_now_playing(itemHandle))
        return fetchArtwork(itemHandle);

    return boost::make_future(ArtworkResult());
}

boost::unique_future<ArtworkResult> PlayerImpl::fetchArtwork(const ArtworkQuery& query)
{
    auto playlist = playlists_->resolve(query.playlist);

    metadb_handle_ptr itemHandle;

    if (!playlistManager_->playlist_get_item_handle(itemHandle, playlist, query.index))
        throw InvalidRequestException("Playlist item index is out of range");

    return fetchArtwork(itemHandle);
}

boost::unique_future<ArtworkResult> PlayerImpl::fetchArtwork(const metadb_handle_ptr& itemHandle) const
{
    abort_callback_dummy dummyCallback;

    auto extractor = albumArtManager_->open(
        pfc::list_single_ref_t(itemHandle),
        pfc::list_single_ref_t(album_art_ids::cover_front),
        dummyCallback);

    if (extractor.is_empty())
        return boost::make_future<ArtworkResult>(ArtworkResult());

    service_ptr_t<album_art_data> artData;
    if (!extractor->query(album_art_ids::cover_front, artData, dummyCallback))
        return boost::make_future<ArtworkResult>(ArtworkResult());

    return boost::make_future<ArtworkResult>(ArtworkResult(artData->get_ptr(), artData->get_size()));
}

TitleFormatVector PlayerImpl::compileColumns(const std::vector<std::string>& columns)
{
    TitleFormatVector compiledColumns;
    compiledColumns.reserve(columns.size());

    for (auto& column : columns)
    {
        service_ptr_t<titleformat_object> compiledColumn;

        if (!titleFormatCompiler_->compile(compiledColumn, column.c_str()))
            throw InvalidRequestException("Invalid title format: " + column);

        compiledColumns.emplace_back(std::move(compiledColumn));
    }

    return compiledColumns;
}

}
}
