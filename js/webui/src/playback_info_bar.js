import React from 'react';
import ModelBinding from './model_binding.js';
import { PlaybackState } from 'beefweb-client';
import ServiceContext from './service_context.js';
import noCover from './no-cover.webp';

class PlaybackInfoBar_ extends React.PureComponent
{
    static contextType = ServiceContext;

    constructor(props, context)
    {
        super(props, context);

        this.state = this.getStateFromModel();
        this.onCoverLoadError = () => {
            this.setState({ artworkFailed: true });
        }
    }

    getStateFromModel()
    {
        const { playerModel } = this.context;

        const title = playerModel.playbackState !== PlaybackState.stopped
            ? (playerModel.activeItem.columns[1] || '')
            : playerModel.info.title;
        const artwork = playerModel.playbackState !== PlaybackState.stopped ?
            playerModel.activeItem.index >= 0 ?
                `/api/artwork/${playerModel.activeItem.playlistId}/${playerModel.activeItem.index}` : noCover : noCover;
        return { title, artwork };
    }

    UNSAFE_componentWillUpdate(nextProps, nextState) 
    {
        if (nextState.artwork !== this.state.artwork) {
            this.setState({ artworkFailed: false });
        }
    }

    render()
    {
        const { title, artwork, artworkFailed } = this.state;
        const titleElements = title.split('-').map(e => e.trim())

        return (
            <div className='panel playback-info-bar' title={title}>
                <div className='cover'>
                    <img alt='cover' onError={this.onCoverLoadError} src={!artworkFailed ? artwork : noCover} />
                </div>
                <div className='title'>
                    {
                        titleElements.map((e, index) => <div key={index} className='title-item'>{e}</div>)
                    }
                </div>
            </div>
        )
    }
}

const PlaybackInfoBar = ModelBinding(PlaybackInfoBar_, {
    playerModel: 'change',
    settingsModel: 'change'
});

export default PlaybackInfoBar;
