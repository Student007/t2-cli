var Tessel = require('./tessel');
var commands = require('./commands');
var logs = require('../logs');
var fs = require('fs');

var RUN_PATH = '/tmp/remote-script/';
var PUSH_PATH = '/app/';
var PUSH_START_SCRIPT_NAME = 'start';
var NODE_PUSH_SCRIPT = __dirname + '/../../resources/start_node_script.sh';
/*
  Run a script on a Tessel
    param opts: unused so far
    param push: whether or not this script is pushed into RAM or flash
*/
Tessel.prototype.deployScript = function(opts, push) {
  var self = this;
  return new Promise(function(resolve, reject) {

    var filepath = push ? PUSH_PATH : RUN_PATH;
    if (push) {
      filepath = PUSH_PATH;
    }
    // Stop running any existing scripts
    return stopRunningScript(self, filepath)
      .then(function() {
        // Delete any code that was previously at this file path
        return deleteOldCode(self, filepath);
      })
      .then(function() {
        // Create the folder again
        return createNewCodeFolder(self, filepath);
      })
      .then(function() {
        // Bundle and send tarred code to T2
        return untarStdin(self, filepath, opts, push);
      })
      .then(function(ret) {
        // If we are pushing
        if (push) {
          // Push the script into flash
          pushScript(self, opts.entryPoint)
            .then(resolve);
        }
        // If we are pushing
        else {
          // Push the code into ram
          runScript(self, filepath, ret, opts.entryPoint)
            .then(resolve);
        }
      })
      .catch(reject);
  });
};

function stopRunningScript(t, filepath) {
  return runCommandUntilClose(t, commands.stopRunningScript(filepath));
}

function deleteOldCode(t, filepath) {
  return runCommandUntilClose(t, commands.deleteFolder(filepath));
}

function createNewCodeFolder(t, filepath) {
  return runCommandUntilClose(t, commands.createFolder(filepath));
}

function runCommandUntilClose(tessel, command) {
  return new Promise(function(resolve) {
    return tessel.connection.exec(command)
      .then(function(remoteProcess) {
        remoteProcess.once('close', resolve);
      });
  });
}

function untarStdin(t, filepath, opts, push) {
  return new Promise(function(resolve, reject) {
    // Execute the command to untar the code tarball
    return t.connection.exec(commands.untarStdin(filepath))
      // Once the process starts running
      .then(function(remoteProcess) {
        // Concat variable
        var errData = '';
        // If we ever get error data
        remoteProcess.stderr.on('data', function(d) {
          // Add it to our concat var
          errData = d.toString();
        });

        // Include the classic Tessel library for bundling up the code
        var tesselClassic = global.IS_TEST_ENV ?
          require('../../test/common/tessel-classic') :
          require('tessel');

        // Gather details about the file structure of the script being sent
        var ret = tesselClassic.analyzeScript(process.cwd() + '/' + opts.entryPoint, {
          verbose: opts.verbose
        });

        // Tar up the code to improve transfer rates
        tesselClassic.tarCode(ret.pushdir, {
          node: true
        }, function(err, bundle) {
          if (err) {
            return reject(err);
          }
          // RAM or Flash for log
          var memtype;
          if (push) {
            memtype = 'Flash';
          } else {
            memtype = 'RAM';
          }
          // Log write
          logs.info('Writing %s to %s on %s (%d kB)...', opts.entryPoint, memtype, t.name, bundle.length / 1000);

          // Wait for the transfer to finish...
          remoteProcess.once('close', function() {
            if (errData.length) {
              return reject(errData);
            } else {
              logs.info('Deployed.');
              resolve(ret);
            }
          });
          // Write the code bundle to the hardware
          remoteProcess.stdin.end(bundle);
        });
      });
  });
}

function runScript(t, filepath, ret, entryPoint) {
  logs.info('Running %s...', entryPoint);
  return new Promise(function(resolve) {
    return t.connection.exec(commands.runScript(filepath, ret.relpath))
      .then(function(remoteProcess) {
        function scriptStopped() {
          logs.info('Stopping script...');
          resolve();
        }

        // Once we get a SIGINT from the console, stop the script
        process.once('SIGINT', scriptStopped);

        // When the stream closes
        remoteProcess.once('close', function removeListener() {
          // Remove the process listener
          process.removeListener('SIGINT', scriptStopped);
          // Report the stopped script and quit
          scriptStopped();
        });

        // Pipe data and errors
        remoteProcess.stdout.pipe(process.stdout);
        remoteProcess.stderr.pipe(process.stderr);
      });

  });
}

function pushScript(t, entryPoint) {
  // Write the node start file
  return writeToFile(t)
    .then(function start() {
      // Then start the script
      return startPushedScript(t, entryPoint);
    });
}

function writeToFile(t) {
  return new Promise(function(resolve, reject) {
    // Path of the script to run a Node project
    var executablePath = PUSH_PATH + PUSH_START_SCRIPT_NAME;
    // Open a stdin pipe tp the file
    return t.connection.exec(commands.openStdinToFile(executablePath))
      // If it was opened successfully
      .then(function(remoteProcess) {
        // When the remote process finishes
        remoteProcess.stdin.once('finish', function() {
          // Set the perimissions on the file to be executable
          return t.connection.exec(commands.setExecutablePermissions(executablePath))
            .then(function(remoteProcess) {
              // When that process completes
              remoteProcess.once('close', function() {
                // Let the user know
                logs.info('You may now disconnect from the Tessel. Your code will be run whenever Tessel boots up. To remove this code, use `tessel erase`.');
                return resolve();
              });
            });
        });

        // Read the contents of the node start script
        fs.readFile(NODE_PUSH_SCRIPT, function(err, data) {
          if (err) {
            return reject(err);
          }
          // Write the Node start script
          remoteProcess.stdin.end(data);
        });
      });
  });
}

function startPushedScript(t, entryPoint) {
  return new Promise(function(resolve) {
    // Once it has been written, run the script with Node
    return t.connection.exec(commands.startPushedScript())
      .then(function(remoteProcess) {
        remoteProcess.once('close', function() {
          logs.info('Running %s...', entryPoint);
          return resolve();
        });
      });
  });
}
