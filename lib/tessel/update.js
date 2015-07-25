var Tessel = require('./tessel');

/*
  Gathers openWRT and SAMD21 Firmware
  image information.
*/
Tessel.prototype.fetchCurrentBuildInfo = function() {
  return new Promise(function(resolve) {
    // TODO:
    resolve({
      version: '1.0.0',
      builds: {
        sam: '1.0.0',
        mediatek: '1.0.0'
      }
    });
  });
};

Tessel.prototype.update = function(newImage) {
  return new Promise(function(resolve) {
    // TODO:
    // To appease grunt
    newImage = newImage;
    resolve();
  });
};
