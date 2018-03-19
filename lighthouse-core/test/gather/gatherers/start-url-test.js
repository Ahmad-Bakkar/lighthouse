/**
 * @license Copyright 2017 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */
'use strict';

/* eslint-env mocha */

const StartUrlGatherer = require('../../../gather/gatherers/start-url');
const assert = require('assert');
const tracingData = require('../../fixtures/traces/network-records.json');

const mockDriver = {
  goOffline() {
    return Promise.resolve();
  },
  goOnline() {
    return Promise.resolve();
  },
  off() {},
};

const wrapSendCommand = (mockDriver, url, status = 200, fromServiceWorker = false) => {
  mockDriver = Object.assign({}, mockDriver);
  mockDriver.evaluateAsync = () => Promise.resolve();
  mockDriver.on = (name, cb) => {
    cb({response: {status, url, fromServiceWorker}});
  };

  mockDriver.getAppManifest = () => {
    return Promise.resolve({
      data: '{"start_url": "' + url + '"}',
      errors: [],
      url,
    });
  };

  return mockDriver;
};

describe('Start-url gatherer', () => {
  it('returns an artifact set to -1 when offline loading fails', () => {
    const startUrlGatherer = new StartUrlGatherer();
    const startUrlGathererWithQueryString = new StartUrlGatherer();
    const throwOnEvaluate = (mockDriver) => {
      mockDriver.on = () => {};
      mockDriver.evaluateAsync = () => {
        throw new Error({
          TypeError: 'Failed to fetch',
          __failedInBrowser: true,
          name: 'TypeError',
          message: 'Failed to fetch',
        });
      };

      return mockDriver;
    };

    const options = {
      url: 'https://do-not-match.com/',
      driver: throwOnEvaluate(wrapSendCommand(mockDriver, 'https://do-not-match.com/', -1)),
    };
    const optionsWithQueryString = {
      url: 'https://ifixit-pwa.appspot.com/?history',
      driver: throwOnEvaluate(wrapSendCommand(mockDriver, 'https://ifixit-pwa.appspot.com/?history', -1)),
    };

    return Promise.all([
      startUrlGatherer.afterPass(options),
      startUrlGathererWithQueryString.afterPass(optionsWithQueryString),
    ]).then(([artifact, artifactWithQueryString]) => {
      assert.equal(artifact.statusCode, -1);
      assert.ok(artifact.debugString, 'did not set debug string');
      assert.equal(artifactWithQueryString.statusCode, -1);
      assert.ok(artifactWithQueryString.debugString, 'did not set debug string');
    });
  });

  it('returns an artifact set to 200 when offline loading succeeds', () => {
    const startUrlGatherer = new StartUrlGatherer();
    const startUrlGathererWithFragment = new StartUrlGatherer();
    const options = {
      url: 'https://ifixit-pwa.appspot.com/',
      driver: wrapSendCommand(mockDriver, 'https://ifixit-pwa.appspot.com/', 200, true),
    };
    const optionsWithQueryString = {
      url: 'https://ifixit-pwa.appspot.com/#/history',
      driver: wrapSendCommand(mockDriver, 'https://ifixit-pwa.appspot.com/#/history', 200, true),
    };

    return Promise.all([
      startUrlGatherer.afterPass(options, tracingData),
      startUrlGathererWithFragment.afterPass(optionsWithQueryString, tracingData),
    ]).then(([artifact, artifactWithFragment]) => {
      assert.equal(artifact.statusCode, 200);
      assert.equal(artifactWithFragment.statusCode, 200);
    });
  });

  it('returns a debugString when manifest cannot be found', () => {
    const startUrlGatherer = new StartUrlGatherer();
    const options = {
      url: 'https://ifixit-pwa.appspot.com/',
      driver: wrapSendCommand(mockDriver, ''),
    };

    return startUrlGatherer.afterPass(options, tracingData)
      .then(artifact => {
        assert.equal(artifact.debugString, 'ERROR: start_url string empty');
      });
  });

  it('returns an error when origin is not the same', () => {
    const startUrlGatherer = new StartUrlGatherer();
    const options = {
      url: 'https://ifixit-pwa.appspot.com/',
      driver: wrapSendCommand(mockDriver, 'https://not-same-origin.com/'),
    };

    return startUrlGatherer.afterPass(options, tracingData)
      .then(artifact => {
        assert.equal(artifact.debugString, 'ERROR: start_url must be same-origin as document');
      });
  });
});
