/*
  Requests a list of available builds from the
  build server. Returns list of build names in
  a Promise.
*/
function fetchBuildList() {
  return new Promise(function(resolve) {
    // TODO
    resolve([{
      version: '0.0.1',
      released: new Date(),
      crc: new Buffer(0)
    }]);
  });
}

/* 
  Accepts a build name and attempts to fetch
  the build images from the server. Returns build contents
  in a Promise
*/
function fetchBuild(buildName) {
  return new Promise(function(resolve) {
    // TODO
    // To appease grunt
    buildName = buildName;
    resolve({
      version: '1.0.0',
      binaries: {
        sam: new Buffer(0),
        mediatek: new Buffer(0)
      }
    });
  });
}

module.exports.fetchBuildList = fetchBuildList;
module.exports.fetchBuild = fetchBuild;
