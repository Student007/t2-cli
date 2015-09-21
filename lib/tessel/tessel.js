/*
  Constructor function for Tessel objects
    param connection: the Connection object that represents the physical comm bus
*/
function Tessel(connection) {
  var self = this;

  if (connection === undefined) {
    throw new Error('Cannot create a Tessel with an undefined connection type');
  }

  self.usbConnection = undefined;
  self.lanConnection = undefined;

  var endConnection = function() {
    if (self.closed) {
      return Promise.resolve();
    } else {
      self.closed = true;
    }
    return new Promise(function(resolve, reject) {
      // Kill all of this Tessel's remote processes
      return self.connection.end()
        .then(function() {
          // Exit the process
          process.on('exit', function(code) {
            process.exit(code);
          });

          resolve();
        })
        .catch(reject);
    });
  };

  // Once we get a SIGINT from the console
  process.once('SIGINT', endConnection);

  self.close = function() {
    // Remove the SIGINT listener because it's not needed anymore
    if (!self.closed) {
      process.removeListener('SIGINT', endConnection);
    }
    // End the connection
    return endConnection();
  };

  self.addConnection = function(connection) {
    // Set the connection var so we have an abstract interface to relay comms
    switch (connection.connectionType) {
      case 'USB':
        self.usbConnection = connection;
        break;
      case 'LAN':
        self.lanConnection = connection;
        break;
      default:
        throw new Error('Invalid connection provided! Must be USB or LAN.');
    }
  };

  // Add this physical connection to the Tessel
  self.addConnection(connection);
  // The human readable name of the device
  self.name = undefined;
  // The unique serial number of the device
  self.serialNumber = undefined;
  // Whether or not this connection has been ended
  self.closed = false;
}

Object.defineProperty(Tessel.prototype, 'connection', {
  get: function() {
    // If we have an authorized LAN connection, prefer that
    if (this.lanConnection && this.lanConnection.authorized) {
      return this.lanConnection;
    }
    // If we have a USB connection, prefer that next
    else if (this.usbConnection) {
      return this.usbConnection;
    }
    // Worse case, we just have a non authorized LAN connection
    else if (this.lanConnection) {
      return this.lanConnection;
    }
  }
});

module.exports = Tessel;

require('./provision');
require('./name');
require('./deploy');
require('./erase');
require('./wifi');
require('./update');
