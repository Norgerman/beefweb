'use strict';

const { URL, URLSearchParams } = require('url');
const axios = require('axios');
const EventSource = require('eventsource');
const pickBy = require('lodash/pickBy');

function formatParams(params)
{
    const usefulParams = pickBy(params, value => typeof value !== 'undefined');

    return new URLSearchParams(usefulParams).toString();
}

class TrackedEventSource extends EventSource
{
    constructor(owner, url)
    {
        super(url);
        this.owner = owner;
    }

    close(unregister = true)
    {
        if (unregister)
            this.owner.unregisterEventSource(this);

        super.close();
    }
}

class RequestHandler
{
    constructor(baseUrl)
    {
        this.baseUrl = baseUrl;
        this.init();
    }

    init()
    {
        this.lastStatus = 0;
        this.cancelSource = axios.CancelToken.source();
        this.eventSources = new Set();

        this.axios = axios.create({
            baseURL: this.baseUrl,
            timeout: 5000,
            paramsSerializer: formatParams,
            cancelToken: this.cancelSource.token
        });
    }

    reset()
    {
        this.cancelSource.cancel('Abort');

        for (let source of this.eventSources)
            source.close(false);

        this.init();
    }

    async get(url, params)
    {
        this.lastStatus = 0;
        const config = params ? { params } : undefined;
        const result = await this.axios.get(url, config);
        this.lastStatus = result.status;
        return result.data;
    }

    async post(url, data)
    {
        this.lastStatus = 0;
        const result = await this.axios.post(url, data);
        this.lastStatus = result.status;
        return result.data;
    }

    createEventSource(url, callback, options)
    {
        const urlObj = new URL(url, this.baseUrl);

        if (options)
            urlObj.search = formatParams(options);

        const source = new TrackedEventSource(this, urlObj.toString());

        source.addEventListener('message', event => {
            callback(JSON.parse(event.data));
        });

        this.eventSources.add(source);
        return source;
    }

    unregisterEventSource(source)
    {
        this.eventSources.delete(source);
    }
}

module.exports = RequestHandler;
