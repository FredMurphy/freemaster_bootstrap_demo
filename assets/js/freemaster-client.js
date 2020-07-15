/*******************************************************************************
 *
 * NXP Confidential Proprietary
 *
 * Copyright 2018-2020 NXP
 * All Rights Reserved
 *
 * @file           freemaster-client.js
 *
 *******************************************************************************
 *
 * THIS SOFTWARE IS PROVIDED BY NXP "AS IS" AND ANY EXPRESSED OR
 * IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES
 * OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED.
 * IN NO EVENT SHALL NXP OR ITS CONTRIBUTORS BE LIABLE FOR ANY DIRECT,
 * INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
 * SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION)
 * HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT,
 * STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING
 * IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF
 * THE POSSIBILITY OF SUCH DAMAGE.
 *
 ******************************************************************************/

/**
 * @typedef {Object} CommPortInfo
 *
 * Communication port information.
 *
 * @property {string} name              Communication port friendly name
 * @property {string} description       Communication port description
 * @property {string} connection_string Connection string
 * @property {string} elf               Elf file path
 */

/**
 * @typedef {Object} BoardInfo
 *
 * Detected board information.
 *
 * @property {number} protVer      Protocol version
 * @property {number} cfgFlags     Configuration flags
 * @property {number} dataBusWdt   Data bus width
 * @property {number} globVerMajor Major version
 * @property {number} globVerMinor Minor version
 * @property {number} cmdBuffSize  Command buffer size
 * @property {number} recBuffSize  Receive buffer size
 * @property {number} recTimeBase  Recirder time base
 * @property {string} descr        Description
 */

/**
 * @typedef {Object} SymbolInfo
 *
 * Symbol information.
 *
 * @property {string} name Symbol name
 * @property {number} addr Symbol address
 * @property {number} size Symbol size
 * @property {string} type Symbol type
 */

/**
 * @typedef {Object} VariableInfo
 *
 * Variable information.
 *
 * @property {string} name    Variable name
 * @property {number} addr    Variable address
 * @property {string} type    Variable type (int, uint, fract, ufract, float, or double)
 * @property {number} size    Variable size (1, 2, 4, or 8)
 * @property {number} [shift] Number of shift positions (integer variable)
 * @property {number} [mask]  And mask applied on integer variable
 * @property {number} q_n     Number of bits designating fractional portion of fractional variable
 * @property {number} q_m     Number of bits designating integer portion of fractional variable
 */

/**
 * @typedef {Object} RecorderLimits
 *
 * Recorder limits.
 *
 * @property {number} baseRate_ns   Base time at which recorder operates in nanoseconds (0 when unknown or not deterministic)
 * @property {number} buffSize      Total recorder memory size
 * @property {number} recStructSize Overhead structure size (protcol version > 4.0)
 * @property {number} varStructSize Per-variable overhead structure size (protcol version > 4.0)
 */

/**
 * @typedef {Object} RecorderConfig
 *
 * Recorder configuration.
 *
 * @property {number} pointsTotal      Total number of recorded points per variable
 * @property {number} pointsPreTrigger Number of recorded points before trigger
 * @property {number} timeDiv          Time-base multiplier
 */

/**
 * @typedef {Object} TriggerVariable
 *
 * Recorder variable information.
 *
 * @property {string} name    Variable name
 * @property {number} trgType Trigger type
 *
 * | Mask | Description                            |
 * | :--- | :--------------------------------------|
 * | 0x04 | trigger-only                           |
 * | 0x10 | trigger on rising edge _/              |
 * | 0x20 | trigger on falling edge \_             |
 * | 0x40 | 0=normal edge trigger, 1=level trigger |
 * | 0x80 | use variable threshold                 |
 * @property {number} trgThr Trigger trashold
 */

(function (root) {
  'use strict';

  if (typeof require !== 'undefined') {
    root.simple_jsonrpc = require('./simple-jsonrpc-js');
    root.WebSocket = require('ws');
  }

  /**
   * @constructs PCM
   * @classdesc PCM is an adapter class for FreeMASTER Lite API that handles the websocket connections to the service and command conversion to JSON-RPC format. It runs both on front-end (web browsers) and back-end (NodeJS).
   * @description Creates an instance of PCM object.
   *
   * @example
   * // Create a PCM instance
   * function main() {
   *     // main logic of the application
   * };
   * $(document).ready(function() {
   *     var pcm = new PCM(window.location.host, main);
   * });
   *
   * @example
   * // Handle API calls using {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise Promises}
   * pcm.PCM_Function(params)
   *     .then(response => {
   *         console.log("Procedure call succeeded and returned ", response.data);
   *     })
   *     .catch(error => {
   *         console.log("Procedure call failed with the following error ", error);
   *     });
   *
   * @example
   * // Handle API calls as {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/await async functions}
   * try {
   *     let response = await pcm.PCM_Function(params);
   *     console.log("Procedure call succeeded and returned ", response.data);
   * } catch (err) {
   *     console.log("Procedure call failed with the following error ", error);
   * }
   *
   * @param {string}   url           The address of the web server.
   * @param {Function} onSocketOpen  WebSocket open event handler.
   * @param {Function} onSocketClose WebSocket close event handler.
   * @param {Function} onSocketError WebSocket error event handler.
   */
  var PCM = function(url, onSocketOpen, onSocketClose, onSocketError) {

    var jrpc = new root.simple_jsonrpc();
    var socket = new root.WebSocket('ws://' + url);

    this.OnServerError = console.log;
    this.OnSocketOpen = onSocketOpen || console.log;
    this.OnSocketClose = onSocketClose || console.log;
    this.OnSocketError = onSocketError || console.log;

    jrpc.toStream = function(_msg) {
      socket.send(_msg);
    };

    socket.onopen = function(event) {
      this.OnSocketOpen(event);
    }.bind(this);

    socket.onclose = function(event) {
      this.OnSocketClose(event);
    }.bind(this);

    socket.onerror = function(event) {
      this.OnSocketError(event);
    }.bind(this);

    socket.onmessage = function(event) {
      jrpc.messageHandler(event.data);
    };

    function SendRequest(method, args) {
      return new Promise((resolve, reject) => {
        jrpc.call(method, args)
          .then((response) => {
            if (response.success)
              resolve(response);
            else
              reject(response.error);
          })
          .catch((error) => {
            this.OnServerError(error);
          });
      });
    }

    /**
     * Requests Freemaster Lite service version.
     *
     * @example
     * pcm.GetAppVersion().then(response => console.log("App version ", response.data));
     *
     * @returns {Promise} In case of success, resolved promise will contain data property of type string representing the version.
     */
    this.GetAppVersion = function() {
      return SendRequest.call(this, 'GetAppVersion');
    };

    /**
     * Requests communication port name (defined in project file) by index.
     * @see {@link PCM#GetCommPortInfo GetCommPortInfo}
     *
     * @example
     * let index = 0;
     * do {
     *     try {
     *         let response = await pcm.EnumCommPorts(index);
     *         console.log(response.data);
     *         index = index + 1;
     *     } catch (err) {
     *         break;
     *     }
     * } while (true);
     *
     * @param   {number} index Communication port index.
     * @returns {Promise} In case of success, resolved promise will contain data property of type string representing the connection friendly name.
     */
    this.EnumCommPorts = function(index) {
      return SendRequest.call(this, 'EnumCommPorts', [index]);
    };

    /**
     * Requests communication port information (defined in project file).
     * @see {@link PCM#EnumCommPorts EnumCommPorts}
     *
     * @example
     * pcm.EnumCommPorts(0).then(response => {
     *     pcm.GetCommPortInfo(response.data).then(response => {
     *         console.log(response.data);
     *     });
     * });
     *
     * @param   {string} name Communiation port friendly name returned by {@link PCM#EnumCommPorts EnumCommPorts}
     * @returns {Promise} In case of success, resolved promise will contain data property of type {@link CommPortInfo CommPortInfo}.
     */
    this.GetCommPortInfo = function(name) {
      return SendRequest.call(this, 'GetCommPortInfo', [name]);
    };

    /**
     * Starts communication using connection friendly name.
     *
     * @example
     * pcm.StartComm("PortX").then(() => console.log("Communication port open."));
     *
     * @param   {string} name Connection friendly name (defined in project file).
     * @returns {Promise} The result does not carry any relevant data.
     */
    this.StartComm = function(name) {
      return SendRequest.call(this, 'StartComm', [name]);
    };

    /**
     * Stops communication.
     *
     * @example
     * pcm.StopComm().then(() => console.log("Communication port closed."));
     *
     * @returns {Promise} The result does not carry any relevant data.
     */
    this.StopComm = function() {
      return SendRequest.call(this, 'StopComm');
    };

    /**
     * Checks if communication port is open.
     *
     * @example
     * pcm.IsCommPortOpen().then(response => console.log("Is port open ? ", response.data));
     *
     * @returns {Promise} In case of success, resolved promise will contain data property of type bool.
     */
    this.IsCommPortOpen = function() {
      return SendRequest.call(this, 'IsCommPortOpen');
    };

    /**
     * Checks if the board was detected.
     *
     * @example
     * pcm.IsBoardDetected().then(response => console.log("Is board detected ? ", response.data));
     *
     * @returns {Promise} In case of success, resolved promise will contain data property of type bool.
     */
    this.IsBoardDetected = function() {
      return SendRequest.call(this, 'IsBoardDetected');
    };

    /**
     * Requests detected board information.
     *
     * @example
     * pcm.GetDetectedBoardInfo().then(response => console.log("Board information: ", response.data));
     *
     * @deprecated Since protocol version 4.0
     *
     * @returns {Promise} In case of success, resolved promise will contain data property of type {@link BoardInfo BoardInfo} representing board information.
     */
    this.GetDetectedBoardInfo = function() {
      return SendRequest.call(this, 'GetDetectedBoardInfo');
    };

    /**
     * Requests configuration parameter of type uint8.
     *
     * @example
     * pcm.GetConfigParamU8("F1").then(response => console.log("F1: ", response.data));
     *
     * @param   {string} name Parameter name
     *
     * | Name | Description                                   |
     * | :--- | :---------------------------------------------|
     * | F1   | Flags                                         |
     * | RC   | Number of recorders implemented on target     |
     * | SC   | Number of oscilloscopes implemented on target |
     * | PC   | Number of pipes implemented on target         |
     * @returns {Promise} In case of success, resolved promise will contain data property of type number representing parameter value.
     */
    this.GetConfigParamU8 = function(name) {
      return SendRequest.call(this, 'GetConfigParamU8', [name]);
    };

    /**
     * Requests configuration parameter encoded as ULEB128.
     *
     * @example
     * pcm.GetConfigParamULEB("MTU").then(response => console.log("MTU: ", response.data));
     *
     * @param   {string} name Parameter name
     *
     * | Name | Description                                                                       |
     * | :--- | :-------------------------------------------------------------------------------- |
     * | MTU  | Size of an internal communication buffer for handling command and response frames |
     * | BA   | Base address used by optimized memory read/write commands                         |
     * @returns {Promise} In case of success, resolved promise will contain data property of type number representing parameter value.
     */
    this.GetConfigParamULEB = function(name) {
      return SendRequest.call(this, 'GetConfigParamULEB', [name]);
    };

    /**
     * Requests confiugration parameter of type string.
     *
     * | Name | Description             |
     * | :--- | :-----------------------|
     * | VS   | Version string          |
     * | NM   | Application name string |
     * | DS   | Description string      |
     * | BD   | Build date/time string  |
     *
     * @example
     * pcm.GetConfigParamString("VS", 10).then(response => console.log("VS: ", response.data));
     *
     * @param   {string} name  Parameter name
     * @param   {number} [len] String byte length, if missing will be set to the service max buffer size (256)
     * @returns {Promise} In case of success, resolved promise will contain data property of type string representing parameter value.
     */
    this.GetConfigParamString = function(name, len) {
      return SendRequest.call(this, 'GetConfigParamString', [name, len]);
    };

    /**
     * Reads a signed integer value from a memory location.
     *
     * @example
     * pcm.ReadIntVariable(0x20050080, 2).then(response => console.log(response.data));
     *
     * @param   {number|string} addr   Address value or symbol name.
     * @param   {number}        size   Integer size, can be 1, 2, 4, or 8.
     * @returns {Promise} In case of success, resolved promise will contain data property of type number representing the read value.
     */
    this.ReadIntVariable = function(addr, size) {
      return SendRequest.call(this, 'ReadIntVariable', [addr, size]);
    };

    /**
     * Reads an unsigned integer value from a memory location.
     *
     * @example
     * pcm.ReadUIntVariable('var16', 4).then(response => console.log(response.data));
     *
     * @param   {number|string} addr   Address value or symbol name.
     * @param   {number}        size   Integer size, can be 1, 2, 4, or 8.
     * @returns {Promise} In case of success, resolved promise will contain data property of type number representing the read value.
     */
    this.ReadUIntVariable = function(addr, size) {
      return SendRequest.call(this, 'ReadUIntVariable', [addr, size]);
    };

    /**
     * Reads a float value from a memory location.
     *
     * @example
     * pcm.ReadFloatVariable('varFLT').then(response => console.log(response.data));
     *
     * @param   {number|string} addr   Address value or symbol name.
     * @returns {Promise} In case of success, resolved promise will contain data property of type number representing the read value.
     */
    this.ReadFloatVariable = function(addr) {
      return SendRequest.call(this, 'ReadFloatVariable', [addr]);
    };

    /**
     * Reads a double value from a memory location.
     *
     * @example
     * pcm.ReadDoubleVariable('varDBL').then(response => console.log(response.data));
     *
     * @param   {number|string} addr   Address value or symbol name.
     * @returns {Promise} In case of success, resolved promise will contain data property of type number representing the read value.
     */
    this.ReadDoubleVariable = function(addr) {
      return SendRequest.call(this, 'ReadDoubleVariable', [addr]);
    };

    /**
     * Writes a signed integer value to a memory location.
     *
     * @example
     * pcm.WriteIntVariable(0x20050080, 2, 10).then(() => console.log('Value written.'));
     *
     * @param   {number|string} addr   Address value or symbol name.
     * @param   {number}        size   Integer size, can be 1, 2, 4, or 8.
     * @param   {Array<number>} data   Integer value to be written.
     * @returns {Promise} The result does not carry any relevant data.
     */
    this.WriteIntVariable = function(addr, size, data) {
      return SendRequest.call(this, 'WriteIntVariable', [addr, size, data]);
    };

    /**
     * Writes an unsigned integer value to a memory location.
     *
     * @example
     * pcm.WriteUIntVariable("var16", 2, 100).then(() => console.log('Value written.'));
     *
     * @param   {number|string} addr   Address value or symbol name.
     * @param   {number}        size   Integer size, can be 1, 2, 4, or 8.
     * @param   {Array<number>} data   Integer value to be written.
     * @returns {Promise} The result does not carry any relevant data.
     */
    this.WriteUIntVariable = function(addr, size, data) {
      return SendRequest.call(this, 'WriteUIntVariable', [addr, size, data]);
    };

    /**
     * Writes a float value to a memory location.
     *
     * @example
     * pcm.WriteFloatVariable("varFLT", 10.0).then(() => console.log('Value written.'));
     *
     * @param   {number|string} addr Address value or symbol name.
     * @param   {Array<number>} data Float value to be written.
     * @returns {Promise} The result does not carry any relevant data.
     */
    this.WriteFloatVariable = function(addr, data) {
      return SendRequest.call(this, 'WriteFloatVariable', [addr, data]);
    };

    /**
     * Writes a double value to a memory location.
     *
     * @example
     * pcm.WriteDoubleVariable("varDBL", 100.0).then(() => console.log('Value written.'));
     *
     * @param   {number|string} addr   Address value or symbol name.
     * @param   {Array<number>} data   Double value to be written.
     * @returns {Promise} The result does not carry any relevant data.
     */
    this.WriteDoubleVariable = function(addr, data) {
      return SendRequest.call(this, 'WriteDoubleVariable', [addr, data]);
    };

    /**
     * Returs an array of bytes of the requested size from a memory location.
     *
     * @example
     * // read 20 bytes from address 0x20050080
     * pcm.ReadMemory(0x20050080, 20).then(response => console.log(response.data));
     *
     * @param   {number} addr   Address value.
     * @param   {number} size   Number of elements.
     * @returns {Promise} In case of success, resolved promise will contain data property of type Array<number>.
     */
    this.ReadMemory = function(addr, size) {
      return SendRequest.call(this, 'ReadMemory', [addr, size]);
    };

    /**
     * Reads an array of signed integers from a memory location.
     *
     * @example
     * // read 20, 2 byte long, signed integers from address 0x20050080
     * pcm.ReadUIntArray(0x20050080, 20, 2).then(response => console.log(response.data));
     *
     * @param   {number|string} addr   Address value or symbol name.
     * @param   {number}        size   Number of elements.
     * @param   {number}        elSize Element size, can be 1, 2, 4, or 8.
     * @returns {Promise} In case of success, resolved promise will contain data property of type Array<number>.
     */
    this.ReadIntArray = function(addr, size, elSize) {
      return SendRequest.call(this, 'ReadIntArray', [addr, size, elSize]);
    };

    /**
     * Reads an array of unsigned integers from a memory location.
     *
     * @example
     * // read 10, 4 byte long, unsigned integers from the address given by the symbol 'arr16'
     * pcm.ReadIntArray('arr16', 10, 4).then(response => console.log(response.data));
     *
     * @param   {number|string} addr   Address value or symbol name.
     * @param   {number}        size   Number of elements.
     * @param   {number}        elSize Element size, can be 1, 2, 4, or 8.
     * @returns {Promise} In case of success, resolved promise will contain data property of type Array<number>.
     */
    this.ReadUIntArray = function(addr, size, elSize) {
      return SendRequest.call(this, 'ReadUIntArray', [addr, size, elSize]);
    };

    /**
     * Reads an array of floats from a memory location.
     *
     * @example
     * // read 5 floats from the address given by the symbol 'arrFLT'
     * pcm.ReadFloatArray('arrFLT', 5).then(response => console.log(response.data));
     *
     * @param   {number|string} addr   Address value or symbol name.
     * @param   {number}        size   Number of elements.
     * @returns {Promise} In case of success, resolved promise will contain data property of type Array<number>.
     */
    this.ReadFloatArray = function(addr, size) {
      return SendRequest.call(this, 'ReadFloatArray', [addr, size]);
    };

    /**
     * Reads an array of doubles from a memory location.
     *
     * @example
     * // read 5 doubles from the address given by the symbol 'arrDBL'
     * pcm.ReadDoubleArray('arrDBL', 5).then(response => console.log(response.data));
     *
     * @param   {number|string} addr   Address value or symbol name.
     * @param   {number}        size   Number of elements.
     * @returns {Promise} In case of success, resolved promise will contain data property of type Array<number>.
     */
    this.ReadDoubleArray = function(addr, size) {
      return SendRequest.call(this, 'ReadDoubleArray', [addr, size]);
    };

    /**
     * Writes an array of bytes to a memory location.
     *
     * @example
     * pcm.WriteMemory(0x20050080, [1, 2, 3, 4, 5]).then(response => console.log(response.data));
     *
     * @param   {number}        addr   Address value.
     * @param   {Array<number>} data   Array of bytes to be written.
     * @returns {Promise} In case of success, resolved promise will contain data property of type number representing the number of successfully writen array elements.
     */
    this.WriteMemory = function(addr, data) {
      return SendRequest.call(this, 'WriteMemory', [addr, data]);
    };

    /**
     * Writes an array of signed integers to a memory location.
     *
     * @example
     * pcm.WriteIntArray(0x20050080, 2, [1, 2, 3, 4, 5]).then(response => console.log(response.data));
     *
     * @param   {number|string} addr   Address value or symbol name.
     * @param   {number}        elSize Element size, can be 1, 2, 4, or 8.
     * @param   {Array<number>} data   Array of integers to be written.
     * @returns {Promise} In case of success, resolved promise will contain data property of type number representing the number of successfully writen array elements.
     */
    this.WriteIntArray = function(addr, elSize, data) {
      return SendRequest.call(this, 'WriteIntArray', [addr, elSize, data]);
    };

    /**
     * Writes an array of unsigned integers to a memory location.
     *
     * @example
     * pcm.WriteUIntArray('arr16', 4, [100, 1000, 10000, 100000, 1000000]).then(response => console.log(response.data));
     *
     * @param   {number|string} addr   Address value or symbol name.
     * @param   {number}        elSize Element size, can be 1, 2, 4, or 8.
     * @param   {Array<number>} data   Array of integers to be written.
     * @returns {Promise} In case of success, resolved promise will contain data property of type number representing the number of successfully writen array elements.
     */
    this.WriteUIntArray = function(addr, elSize, data) {
      return SendRequest.call(this, 'WriteUIntArray', [addr, elSize, data]);
    };

    /**
     * Writes an array of floats to a memory location.
     *
     * @example
     * pcm.ReadFloatArray('arrFLT', [1.0, 2.0, 3.0, 4.0, 5.0]).then(response => console.log(response.data));
     *
     * @param   {number|string} addr   Address value or symbol name.
     * @param   {number}        data   Array of floats to be written.
     * @returns {Promise} In case of success, resolved promise will contain data property of type number representing the number of successfully writen array elements.
     */
    this.WriteFloatArray = function(addr, data) {
      return SendRequest.call(this, 'WriteFloatArray', [addr, data]);
    };

    /**
     * Writes an array of doubles to a memory location.
     *
     * @example
     * pcm.WriteDoubleArray('arrDBL', [1.0, 2.0, 3.0, 4.0, 5.0]).then(response => console.log(response.data));
     *
     * @param   {number|string} addr   Address value or symbol name.
     * @param   {number}        size   Array of doubles to be written.
     * @returns {Promise} In case of success, resolved promise will contain data property of type number representing the number of successfully writen array elements.
     */
    this.WriteDoubleArray = function(addr, data) {
      return SendRequest.call(this, 'WriteDoubleArray', [addr, data]);
    };

    /**
     * Sends the command to read symbols from the elf file associated with the current connection (defined in project file).
     * @see {@link PCM#EnumSymbols EnumSymbols}
     *
     * @example
     * pcm.ReadELF().then(response => console.log(response.data.count + " symbols extracted from ELF file."));
     *
     * @returns {Promise} In case of success, resolved promise will contain the number of extracted symbols.
     */
    this.ReadELF = function(elfFile) {
      return SendRequest.call(this, 'ReadELF', [elfFile]);
    };

    /**
     * Sends the command to read symbols from the TSA table from the connected target.
     * @see {@link PCM#EnumSymbols EnumSymbols}
     *
     * @example
     * pcm.ReadTSA().then(response => console.log(response.data.count + " symbols extracted from TSA table."));
     *
     * @returns {Promise} In case of success, resolved promise will contain the number of extracted symbols.
     */
    this.ReadTSA = function() {
      return SendRequest.call(this, 'ReadTSA');
    };

    /**
     * Requests symbol (extracted from ELF file or TSA table) name by index.
     * @see {@link PCM#ReadELF ReadELF}
     * @see {@link PCM#ReadTSA ReadTSA}
     * @see {@link PCM#GetSymbolInfo GetSymbolInfo}
     *
     * @example
     * let index = 0;
     * do {
     *     try {
     *         let response = await pcm.EnumSymbols(index);
     *         console.log(response.data);
     *         index = index + 1;
     *     } catch (err) {
     *         break;
     *     }
     * } while (true);
     *
     * @param   {number} index Symbol index.
     * @returns {Promise} In case of success, resolved promise will contain data property of type string representing the symbol name.
     */
    this.EnumSymbols = function(index) {
      return SendRequest.call(this, 'EnumSymbols', [index]);
    };

    /**
     * Requests symbol information.
     * @see {@link PCM#EnumSymbols EnumSymbols}
     *
     * @example
     * pcm.EnumSymbols(0).then(response => {
     *     pcm.GetSymbolInfo(response.data).then(response => {
     *         console.log(response.data);
     *     });
     * });
     *
     * @param   {string} name Symbol name returned by {@link PCM#EnumSymbols EnumSymbols}
     * @returns {Promise} In case of success, resolved promise will contain data property of type {@link SymbolInfo SymbolInfo}.
     */
    this.GetSymbolInfo = function(name) {
      return SendRequest.call(this, 'GetSymbolInfo', [name]);
    };

    /**
     * Requests variable name by index.
     * @see {@link PCM#DefineVariable DefineVariable}
     * @see {@link PCM#GetVariableInfo GetVariableInfo}
     *
     * @example
     * let index = 0;
     * do {
     *     try {
     *     let response = await pcm.EnumVariables(index);
     *     console.log(response.data);
     *     index = index + 1;
     *     } catch (err) {
     *         break;
     *     }
     * } while (true);
     *
     * @param   {number} index Variable index.
     * @returns {Promise} In case of success, resolved promise will contain data property of type string representing the variable name.
     */
    this.EnumVariables = function(index) {
      return SendRequest.call(this, 'EnumVariables', [index]);
    };

    /**
     * Requests variable information.
     * @see {@link PCM#DefineVariable DefineVariable}
     *
     * @example
     * pcm.EnumVariables(0).then(response => {
     *     pcm.GetVariableInfo(response.data).then(response => {
     *         console.log(response.data);
     *     });
     * });
     *
     * @param   {string} name Variable name.
     * @returns {Promise} In case of success, resolved promise will contain data property of type {@link VariableInfo VariableInfo}.
     */
    this.GetVariableInfo = function(name) {
      return SendRequest.call(this, 'GetVariableInfo', [name]);
    };

    /**
     * Defines a variable.
     *
     * @example
     * let variable = { name: "var16", addr: 0x20050080, type: "uint", size: 4 }
     * pcm.DefineVariable(variable).then(() => console.log("Variable successfully defined."));
     *
     * @param   {VariableInfo} variable Variable information
     * @returns {Promise} The result does not carry any relevant data.
     */
    this.DefineVariable = function(variable) {
      return SendRequest.call(this, 'DefineVariable', [variable]);
    };

    /**
     * Delete an user defined variable (except those defined in project file).
     *
     * @example
     * pcm.DeleteVariable("var16").then(() => console.log("Variale deleted."));
     *
     * @param   {string} name Variable name.
     * @returns {Promise} The result does not carry any relevant data.
     */
    this.DeleteVariable = function(name) {
      return SendRequest.call(this, 'DeleteVariable', [name]);
    };

    /**
     * Deletes all user defined variables (except those defined in project file).
     *
     * @example
     * pcm.DeleteAllScriptVariables().then(() => console.log("Script variales deleted."));
     *
     * @returns {Promise} The result does not carry any relevant data.
     */
    this.DeleteAllScriptVariables = function() {
      return SendRequest.call(this, 'DeleteAllScriptVariables');
    };

    /**
     * Reads variable value according to the predefined variable information.
     * @see {@link PCM#DefineVariable DefineVariable}
     *
     * @example
     * pcm.ReadVariable("var16").then(response => console.log(response.data));
     *
     * @param   {string} name Variable name.
     * @returns {Promise} In case of success, resolved promise will contain data property of type number representing variable value.
     */
    this.ReadVariable = function(name) {
      return SendRequest.call(this, 'ReadVariable', [name]);
    };

    /**
     * Writes a variable value according to the predefined variable information.
     * @see {@link PCM#DefineVariable DefineVariable}
     *
     * @example
     * pcm.WriteVariable("var16", 255).then(() => console.log("Value successfully written."));
     *
     * @param   {string} name Variable name.
     * @returns {Promise} The result does not carry any relevant data.
     */
    this.WriteVariable = function(name, value) {
      return SendRequest.call(this, 'WriteVariable', [name, value]);
    };

    /**
     * Setups an oscilloscope with a specific ID.
     *
     * Notes:
     * * Scope ID should be in the target supported range (defined in the embedded application).
     * * All the variables should be defiend prior to scope definition.
     * * Older protocol version (< 4.0) support only one scope instance.
     *
     * @see {@link PCM#GetOscilloscopeData GetOscilloscopeData}
     *
     * @example
     * let id = 0;
     * let vars = ['myVAr1', 'myVar2', 'myVar3'];
     * pcm.SetupOscilloscope(id, vars).then(() => console.log("Scope was setup successfully."));
     *
     * @param   {number}        id   Oscilloscope ID.
     * @param   {Array<string>} vars Oscilloscope variables names.
     * @returns {Promise} The result does not carry any relevant data.
     */
    this.SetupOscilloscope = function(id, vars) {
      return SendRequest.call(this, 'SetupOscilloscope', [id, vars]);
    };

    /**
     * Requests oscilloscope data.
     *
     * The values will be returned in the format defined by each variable.
     *
     * @see {@link PCM#SetupOscilloscope SetupOscilloscope}
     *
     * @example
     * let id = 0;
     * let vars = ['myVAr1', 'myVar2', 'myVar3'];
     * pcm.SetupOscilloscope(id, vars).then(() => {
     *     pcm.GetOscilloscopeData(id).then(response => console.log(response.data));
     * });
     *
     * @param   {number} id Scope ID.
     * @returns {Promise} In case of success, resolved promise will contain data property of type array of numbers (variables corresponding values in the defined order).
     */
    this.GetOscilloscopeData = function(id) {
      return SendRequest.call(this, 'GetOscilloscopeData', [id]);
    };

    /**
     * Requests recorder limits.
     *
     * @example
     * let id = 0;
     * pcm.GetRecorderLimits(id).then(response => console.log(response.data));
     *
     * @param   {number} id Recorder ID.
     * @returns {Promise} In case of success, resolved promise will contain data property of type {@link RecorderLimits RecorderLimits}.
     */
    this.GetRecorderLimits = function(id) {
      return SendRequest.call(this, 'GetRecorderLimits', [id]);
    };

    /**
     * Setups a recorder with a specific ID.
     *
     * Notes:
     * * Recorder ID should be in the target supported range (defined in the embedded application).
     * * All the variables should be defiend prior to recorder definitions.
     * * Older protocol version (< 4.0) support only one recorder instance.
     *
     * @example
     * let id = 0;
     * let config = {
     *     pointsTotal: 100,
     *     pointsPreTrigger: 50,
     *     timeDiv: 1
     * };
     * let recVars = ['myVAr1', 'myVar2', 'myVar3'];
     * let trgVars = [{ name: 'myVar2', trgType: 0x11, trgThr: 2000 }];
     * pcm.SetupRecorder(id, config, recVars, trgVars).then(() => console.log("Recorder was setup successfully."));
     *
     * @param   {number}                 id      Recorder ID.
     * @param   {RecorderConfig}         config  Recorder configuartion.
     * @param   {Array<string>}          recVars Recorded variables.
     * @param   {Array<TriggerVariable>} trgVars Trigger variables.
     * @returns {Promise} The result does not carry any relevant data.
     */
    this.SetupRecorder = function(id, config, recVars, trgVars) {
      return SendRequest.call(this, 'SetupRecorder', [id, config, recVars, trgVars]);
    };

    /**
     * Starts a recorder.
     * @see {@link PCM#SetupRecorder SetupRecorder}
     *
     * @example
     * pcm.StartRecorder(id).then(() => console.log("Recorder started"));
     *
     * @param   {number} id Recorder ID.
     * @returns {Promise} The result does not carry any relevant data.
     */
    this.StartRecorder = function(id) {
      return SendRequest.call(this, 'StartRecorder', [id]);
    };

    /**
     * Stops a recorder.
     * @see {@link PCM#SetupRecorder SetupRecorder}
     * @see {@link PCM#StartRecorder StartRecorder}
     *
     * @example
     * pcm.StopRecorder(id).then(() => console.log("Recorder stoped"));
     *
     * @param   {number} id Recorder ID.
     * @returns {Promise} The result does not carry any relevant data.
     */
    this.StopRecorder = function(id) {
      return SendRequest.call(this, 'StopRecorder', [id]);
    };

    /**
     * Requests recorder status.
     * @see {@link PCM#SetupRecorder SetupRecorder}
     * @see {@link PCM#StartRecorder StartRecorder}
     *
     * @example
     * pcm.GetRecorderStatus(id).then(response => console.log(response.data));
     *
     * @param   {number} id Recorder ID.
     * @returns {Promise} In case of success, resolved promise will contain data property of type number.
     *
     * | Code | Status                           |
     * | :--- | :------------------------------- |
     * | 0x00 | not configured                   |
     * | 0x01 | configured, stoped, no data      |
     * | 0x02 | running                          |
     * | 0x04 | stopped, not enough data sampled |
     * | 0x05 | stopped, data ready              |
     */
    this.GetRecorderStatus = function(id) {
      return SendRequest.call(this, 'GetRecorderStatus', [id]);
    };

    /**
     * Gets recorded data.
     *
     * @example
     * pcm.GetRecorderData(id).then(response => console.log(response.data));
     *
     * @param   {number} id Recorder ID.
     * @returns {Promise} In case of success, resolved promise will contain data property of type array of arrays of numbers.
     */
    this.GetRecorderData = function(id) {
      return SendRequest.call(this, 'GetRecorderData', [id]);
    };

    /**
     * Opens a pipe.
     *
     * @example
     * pcm.PipeOpen(0, 100, 100).then(() => console.log("Pipe open."));
     *
     * @param   {number} port         Pipe ID.
     * @param   {number} txBufferSize Send buffer size.
     * @param   {number} rxBufferSize Receive buffer size.
     * @returns {Promise} The result does not carry any relevant data.
     */
    this.PipeOpen = function(port, txBufferSize, rxBufferSize) {
      return SendRequest.call(this, 'PipeOpen', [port, txBufferSize, rxBufferSize]);
    };

    /**
     * Closes a pipe.
     *
     * @example
     * pcm.PipeClose(0).then(() => console.log("Pipe closed."));
     *
     * @param   {number} port Pipe ID.
     * @returns {Promise} The result does not carry any relevant data.
     */
    this.PipeClose = function(port) {
      return SendRequest.call(this, 'PipeClose', [port]);
    };

    /**
     * Flushes a pipe.
     *
     * @example
     * pcm.PipeFlush(0).then(() => console.log("Pipe flushed."));
     *
     * @param   {number} port Pipe ID.
     * @returns {Promise} The result does not carry any relevant data.
     */
    this.PipeFlush = function(port, timeout) {
      return SendRequest.call(this, 'PipeFlush', [port, timeout]);
    };

    /**
     * Sets pipes default receive mode.
     *
     * @example
     * pcm.PipeSetDefaultRxMode(false, 100).then(() => console.log("Default RX mode updated."));
     *
     * @param   {boolean} rxAllOrNothing Flag specifying whether the data should be read all at once.
     * @param   {number}  rxTimeout_ms   Read timeout in milliseconds.
     * @returns {Promise} The result does not carry any relevant data.
     */
    this.PipeSetDefaultRxMode = function(rxAllOrNothing, rxTimeout_ms) {
      return SendRequest.call(this, 'PipeSetDefaultRxMode', [rxAllOrNothing, rxTimeout_ms]);
    };

    /**
     * Sets pipes default string mode.
     *
     * @example
     * pcm.PipeSetDefaultStringMode(false).then(() => console.log("Default string mode updated."));
     *
     * @param   {boolean} unicode Flag specifying whether the string are using unicode encoding.
     * @returns {Promise} The result does not carry any relevant data.
     */
    this.PipeSetDefaultStringMode = function(unicode) {
      return SendRequest.call(this, 'PipeSetDefaultStringMode', [unicode]);
    };

    /**
     * Requests the number of bytes pending on the receive buffer.
     *
     * @example
     * pcm.PipeGetRxBytes(0).then(response => console.log(response.data));
     *
     * @param   {number} port Pipe ID.
     * @returns {Promise} In case of success, resolved promise will contain data property of type number.
     */
    this.PipeGetRxBytes = function(port) {
      return SendRequest.call(this, 'PipeGetRxBytes', [port]);
    };

    /**
     * Requests the number of bytes pending on the send buffer.
     *
     * @example
     * pcm.PipeGetTxBytes(0).then(response => console.log(response.data));
     *
     * @param   {number} port Pipe ID.
     * @returns {Promise} In case of success, resolved promise will contain data property of type number.
     */
    this.PipeGetTxBytes = function(port) {
      return SendRequest.call(this, 'PipeGetTxBytes', [port]);
    };

    /**
     * Requests the number of free bytes from the send buffer.
     *
     * @example
     * pcm.PipeGetTxFree(0).then(response => console.log(response.data));
     *
     * @param   {number} port Port number that identified the pipe.
     * @returns {Promise} In case of success, resolved promise will contain data property of type number.
     */
    this.PipeGetTxFree = function(port) {
      return SendRequest.call(this, 'PipeGetTxFree', [port]);
    };

    /**
     * Requests the receive buffer size of a pipe.
     *
     * @example
     * pcm.PipeGetRxBufferSize(0).then(response => console.log(response.data));
     *
     * @param   {number} port Pipe ID.
     * @returns {Promise} In case of success, resolved promise will contain data property of type number.
     */
    this.PipeGetRxBufferSize = function(port) {
      return SendRequest.call(this, 'PipeGetRxBufferSize', [port]);
    };

    /**
     * Requests the send buffer size of a pipe.
     *
     * @example
     * pcm.PipeGetTxBufferSize(0).then(response => console.log(response.data));
     *
     * @param   {number} port Pipe ID.
     * @returns {Promise} In case of success, resolved promise will contain data property of type number.
     */
    this.PipeGetTxBufferSize = function(port) {
      return SendRequest.call(this, 'PipeGetTxBufferSize', [port]);
    };

    /**
     * Writes a string to a pipe.
     *
     * @example
     * pcm.PipeWriteString(0, "Hello world!", false, false).then(response => console.log(response.data));
     *
     * @param   {number}  port         Pipe ID.
     * @param   {string}  str          String to be written to the pipe.
     * @param   {boolean} allOrNothing Flag specifying whether the string should be sent all at once.
     * @param   {boolean} unicode      Flag specifying whether the string is unicode encoded.
     * @returns {Promise} In case of success, resolved promise will contain data property of type number representing the number of successfully writen characters.
     */
    this.PipeWriteString = function(port, str, allOrNothing, unicode) {
      return SendRequest.call(this, 'PipeWriteString', [port, str, allOrNothing, unicode]);
    };

    /**
     * Writes an array of signed integers to a pipe.
     *
     * @example
     * pcm.PipeWriteIntArray(0, 2, [1, 2, 3, 4, 5], false).then(response => console.log(response.data));
     *
     * @param   {number}        port         Pipe ID.
     * @param   {number}        elSize       Element size, can be 1, 2, 4, or 8.
     * @param   {Array<number>} data         Array of integers to be written.
     * @param   {boolean}       allOrNothing Flag specifying whether the string should be sent all at once.
     * @returns {Promise} In case of success, resolved promise will contain data property of type number representing the number of successfully writen array elements.
     */
    this.PipeWriteIntArray = function(port, elSize, data, allOrNothing) {
      return SendRequest.call(this, 'PipeWriteIntArray', [port, elSize, data, allOrNothing]);
    };

    /**
     * Writes an array of unsigned integers to a pipe.
     *
     * @example
     * pcm.PipeWriteUIntArray(0, 4, [100, 200, 300, 400, 500], false).then(response => console.log(response.data));
     *
     * @param   {number}        port         Pipe ID.
     * @param   {number}        elSize       Element size, can be 1, 2, 4, or 8.
     * @param   {Array<number>} data         Array of integers to be written.
     * @param   {boolean}       allOrNothing Flag specifying whether the string should be sent all at once.
     * @returns {Promise} In case of success, resolved promise will contain data property of type number representing the number of successfully writen array elements.
     */
    this.PipeWriteUIntArray = function(port, elSize, data, allOrNothing) {
      return SendRequest.call(this, 'PipeWriteUIntArray', [port, elSize, data, allOrNothing]);
    };

    /**
     * Writes an array of floats to a pipe.
     *
     * @example
     * pcm.PipeWriteFloatArray(0, [1.0, 2.0, 3.0, 4.0, 5.0], false).then(response => console.log(response.data));
     *
     * @param   {number}        port         Pipe ID.
     * @param   {Array<number>} data         Array of integers to be written.
     * @param   {boolean}       allOrNothing Flag specifying whether the string should be sent all at once.
     * @returns {Promise} In case of success, resolved promise will contain data property of type number representing the number of successfully writen array elements.
     */
    this.PipeWriteFloatArray = function(port, data, allOrNothing) {
      return SendRequest.call(this, 'PipeWriteFloatArray', [port, data, allOrNothing]);
    };

    /**
     * Writes an array of doubles to a pipe.
     *
     * @example
     * pcm.PipeWriteDoubleArray(0, [10.0, 20.0, 30.0, 40.0, 50.0], false).then(response => console.log(response.data));
     *
     * @param   {number}        port         Pipe ID.
     * @param   {Array<number>} data         Array of integers to be written.
     * @param   {boolean}       allOrNothing Flag specifying whether the string should be sent all at once.
     * @returns {Promise} In case of success, resolved promise will contain data property of type number representing the number of successfully writen array elements.
     */
    this.PipeWriteDoubleArray = function(port, data, allOrNothing) {
      return SendRequest.call(this, 'PipeWriteDoubleArray', [port, data, allOrNothing]);
    };

    /**
        * Reads a string from a pipe.
        *
        * @example
        * pcm.PipeReadString(0, 100, 512, false, false).then(response => console.log(response.data));
        *
        * @param   {number}  port         Pipe ID.
        * @param   {number}  rxTimeout_ms Read timeout in milliseconds.
        * @param   {number}  charsToRead  Number of characters to read.
        * @param   {boolean} allOrNothing Flag specifying whether the string should be read all at once.
        * @param   {boolean} unicode      Flag specifying whether the string is unicode encoded.
        * @returns {Promise} In case of success, resolved promise will contain data property of type number string.
        */
    this.PipeReadString = function(port, rxTimeout_ms, charsToRead, allOrNothing, unicode) {
      return SendRequest.call(this, 'PipeReadString', [port, rxTimeout_ms, charsToRead, allOrNothing, unicode]);
    };

    /**
     * Reads an array of signed integers from a piep.
     *
     * @example
     * pcm.PipeReadIntArray(0, 2, 100, 100, false).then(response => console.log(response.data));
     *
     * @param   {number}  port         Pipe ID.
     * @param   {number}  elSize       Element size, can be 1, 2, 4, or 8.
     * @param   {number}  rxTimeout_ms Read timeout in milliseconds.
     * @param   {number}  size         The size of the array (number of elements).
     * @param   {boolean} allOrNothing Flag specifying whether the array should be read all at once.
     * @returns {Promise} In case of success, resolved promise will contain data property of type Array<number>.
     */
    this.PipeReadIntArray = function(port, elSize, rxTimeout_ms, size, allOrNothing) {
      return SendRequest.call(this, 'PipeReadIntArray', [port, elSize, rxTimeout_ms, size, allOrNothing]);
    };

    /**
     * Reads an array of unsigned integers from a piep.
     *
     * @example
     * pcm.PipeReadUIntArray(0, 4, 100, 100, false).then(response => console.log(response.data));
     *
     * @param   {number}  port         Pipe ID.
     * @param   {number}  elSize       Element size, can be 1, 2, 4, or 8.
     * @param   {number}  rxTimeout_ms Read timeout in milliseconds.
     * @param   {number}  size         The size of the array (number of elements).
     * @param   {boolean} allOrNothing Flag specifying whether the array should be read all at once.
     * @returns {Promise} In case of success, resolved promise will contain data property of type Array<number>.
     */
    this.PipeReadUIntArray = function(port, elSize, rxTimeout_ms, size, allOrNothing) {
      return SendRequest.call(this, 'PipeReadUIntArray', [port, elSize, rxTimeout_ms, size, allOrNothing]);
    };

    /**
        * Reads an array of floats from a piep.
        *
        * @example
        * pcm.PipeReadFloatArray(0, 100, 100, false).then(response => console.log(response.data));
        *
        * @param   {number}  port         Pipe ID.
        * @param   {number}  rxTimeout_ms Read timeout in milliseconds.
        * @param   {number}  size         The size of the array (number of elements).
        * @param   {boolean}  allOrNothing Flag specifying whether the array should be read all at once.
        * @returns {Promise} In case of success, resolved promise will contain data property of type Array<number>.
        */
    this.PipeReadFloatArray = function(port, rxTimeout_ms, size, allOrNothing) {
      return SendRequest.call(this, 'PipeReadFloatArray', [port, rxTimeout_ms, size, allOrNothing]);
    };

    /**
        * Reads an array of doubles from a piep.
        *
        * @example
        * pcm.PipeReadDoubleArray(0, 100, 100, false).then(response => console.log(response.data));
        *
        * @param   {number}  port         Pipe ID.
        * @param   {number}  rxTimeout_ms Read timeout in milliseconds.
        * @param   {number}  size         The size of the array (number of elements).
        * @param   {boolean} allOrNothing Flag specifying whether the array should be read all at once.
        * @returns {Promise} In case of success, resolved promise will contain data property of type Array<number>.
        */
    this.PipeReadDoubleArray = function(port, rxTimeout_ms, size, allOrNothing) {
      return SendRequest.call(this, 'PipeReadDoubleArray', [port, rxTimeout_ms, size, allOrNothing]);
    };

    /**
        * Opens a file on the mashine the servce is running one.
        * @see {@link PCM#LocalFileClose LocalFileClose}
        *
        * @example
        * pcm.LocalFileOpen("D:\\Temp\\temp.txt", "w+").then(() => console.log("File open.");
        *
        * @param   {string} file Path to the file.
        * @param   {string} mode NodeJS file system {@link https://nodejs.org/api/fs.html#fs_file_system_flags flags}.
        * @returns {Promise} In case of success, resolved promise will contain data property of type number representing file descriptor.
        */
    this.LocalFileOpen = function(file, mode) {
      return SendRequest.call(this, 'LocalFileOpen', [file, mode]);
    };

    /**
        * Closes a file.
        * @see {@link PCM#LocalFileOpen LocalFileOpen}
        *
        * @example
        * let result = await pcm.LocalFileClose(3).then(() => console.log("File closed."));
        *
        * @param   {number} handle File descriptor.
        * @returns {Promise} The result does not carry any relevant data.
        */
    this.LocalFileClose = function(handle) {
      return SendRequest.call(this, 'LocalFileClose', [handle]);
    };

    /**
     * Reads a string from an open file.
     * @see {@link PCM#LocalFileOpen LocalFileOpen}
     *
     * @example
     * pcm.LocalFileReadString(3, 255, false).then(response => console.log(response.data));
     *
     * @param   {number}  handle      File descriptor.
     * @param   {number}  charsToRead Numbers of characters to read.
     * @param   {boolean} unicode     Flag specifying whether the string is unicode encoded.
     * @returns {Promise} In case of success, resolved promise will contain data property of type string.
     */
    this.LocalFileReadString = function(handle, charsToRead, unicode) {
      return SendRequest.call(this, 'LocalFileReadString', [handle, charsToRead, unicode]);
    };

    /**
     * Writes a string to an open file.
     * @see {@link PCM#LocalFileOpen LocalFileOpen}
     *
     * @example
     * pcm.LocalFileWriteString(3, "Hello world!", false).then(response => console.log(response.data));
     *
     * @param   {number}  handle      File descriptor.
     * @param   {number}  str         String to write.
     * @param   {boolean} unicode     Flag specifying whether the string is unicode encoded.
     * @param   {boolean} size        Length of the string to write, optional, writes the full 'str' length if undefined.
     * @returns {Promise} In case of success, resolved promise will contain data property of type number representing the number of written characters.
     */
    this.LocalFileWriteString = function(handle, str, unicode, size) {
      return SendRequest.call(this, 'LocalFileWriteString', [handle, str, unicode, size]);
    };

    /**
     * Enables communication library logger.
     * @see {@link PCM#LogDisable LogDisable}
     *
     * @example
     * pcm.LogEnable("Test logger", "Test logger.log").then(() => console.log("Logger enabled."));
     *
     * @param   {string}  name  Logger name.
     * @param   {string}  file  Logger file, if empty all the loggs will be printed in standard output.
     * @returns {Promise} The result does not carry any relevant data.
     */
    this.LogEnable = function(name, file) {
      return SendRequest.call(this, 'LogEnable', [name, file]);
    };

    /**
     * Disables communication library logger.
     * @see {@link PCM#LogEnable LogEnable}
     *
     * @example
     * pcm.LogDisable().then(() => console.log("Logger disabled."));
     *
     * @returns {Promise} The result does not carry any relevant data.
     */
    this.LogDisable = function() {
      return SendRequest.call(this, 'LogDisable');
    };

    /**
     * Sets logging pattern. Refer to [spdlog wiki]{@link https://github.com/gabime/spdlog/wiki/3.-Custom-formatting#pattern-flags} for the list of available flags.
     *
     * @example
     * pcm.LogSetPattern("[%Y-%m-%d %T.%f]: %v").then(() => console.log("Logger pattern updated."));
     *
     * @param   {string}  pattern  Logging pattern.
     * @returns {Promise} The result does not carry any relevant data.
     */
    this.LogSetPattern = function(pattern) {
      return SendRequest.call(this, 'LogSetPattern', [pattern]);
    };

    /**
     * Sets logging verbosity level.
     *
     * @example
     * pcm.LogSetVerbosity(2).then(() => console.log("Verbosity level set to normal."));
     *
     * @param   {number}  verbosity  Logging verbosity level.
     *
     * | Level | Description |
     * | :---- | :---------- |
     * | 0     | OFF         |
     * | 1     | Minimal     |
     * | 2     | Normal      |
     * | 3     | Medium      |
     * | 4     | High        |
     * | 5     | All         |
     * @returns {Promise} The result does not carry any relevant data.
     */
    this.LogSetVerbosity = function(verbosity) {
      return SendRequest.call(this, 'LogSetVerbosity', [verbosity]);
    };

    /**
     * Sets logging service filter.
     *
     * @example
     * // 0xFFFF - disables all current filters
     * // 0x0002 | 0x0004 - enables read and write filtering
     * pcm.LogSetServices(0xFFFF, 0x0002 | 0x0004).then(() => console.log("Filtering read and write services."));
     *
     * @param   {number}  mask      Mask that will disable current filterred services.
     * @param   {number}  services  Mask of services flags to be added to the filter.
     *
     * | Mask   | Service     |
     * | :----- | :---------- |
     * | 0x0001 | Port setup  |
     * | 0x0002 | Data Read   |
     * | 0x0004 | Data Write  |
     * | 0x0008 | Scope       |
     * | 0x0010 | Recorder    |
     * | 0x0020 | App command |
     * | 0x0040 | SFIO        |
     * | 0x0080 | TSA         |
     * | 0x0100 | PIPE        |
     * | 0x0200 | Poolling    |
     * | 0xFFFF | All         |
     * @returns {Promise} The result does not carry any relevant data.
     */
    this.LogSetServices = function(mask, services) {
      return SendRequest.call(this, 'LogSetServices', [mask, services]);
    };

    /**
     * Extends the object by extra methods and events available in full FreeMASTER UI application only.
     * Use this call in Control Pages and other scripts targeting the FreeMASTER application. Note that
     * the extra features will NOT work with FreeMASTER Lite service.
     *
     * @example
     * pcm.EnableExtraFeatures(true);
     * pcm.EnableEvents(true);
     * pcm.OnBoardDetected = function() { console.log("Board connection has been established."); }
     */
    this.EnableExtraFeatures = function(enable) {

      if (enable) {
        /* TODO: throw an exception if this file has been retrieved from the Lite service. */
      } else {
        /* Don't allow to disable the features once enabled. This behavior is subject to change in future versions. */
        if (this.EnableEvents) {
          throw 'Can\'t disable ExtraFeatures after enabled once';
        }

        /* Nothing to do, extra features remain disabled. */
        return;
      }

      /* Install default FreeMASTER event handlers. Don't forget to call EnableEvents(true) for the server to generate the JSON-RPC events. */
      if (!this.OnBoardDetected) {
        this.OnBoardDetected = function() {
          console.log('FreeMASTER Event received: OnBoardDetected()');
        };
      }

      if (!this.OnCommPortStateChanged) {
        this.OnCommPortStateChanged = function(state) {
          console.log('FreeMASTER Event received: OnCommPortStateChanged(' + state + ')');
        };
      }

      if (!this.OnVariableChanged) {
        this.OnVariableChanged = function(name, id, value) {
          console.log('FreeMASTER Event received: OnVariableChanged("' + name + '", ' + id + ', ' + value + ')');
        };
      }

      if (!this.OnRecorderDone) {
        this.OnRecorderDone = function() {
          console.log('FreeMASTER Event received: OnRecorderDone()');
        };
      }

      /* Register event handlers in JSON-RPC */
      jrpc.dispatch('OnBoardDetected', 'pass', (params_array) => this.OnBoardDetected.apply(null, params_array) );
      jrpc.dispatch('OnCommPortStateChanged', 'pass', (params_array) => this.OnCommPortStateChanged.apply(null, params_array) );
      jrpc.dispatch('OnVariableChanged', 'pass', (params_array) => this.OnVariableChanged.apply(null, params_array) );
      jrpc.dispatch('OnRecorderDone', 'pass', (params_array) => this.OnRecorderDone.apply(null, params_array) );

      /**
       * Start or stop the communication. This call is provided for backward compatibility with ActiveX
       * interface only. Use the StartComm and StopComm methods in new designs.
       *
       * @example
       * pcm.StartStopComm(true).then(console.log("Communication port is open"));
       *
       * @param   {boolean} start    Start or stop communication.
       * @returns {Promise} In case of success, resolved promise does not contain any data.
       */
      this.StartStopComm = function(start) {
        return SendRequest.call(this, 'StartStopComm', [start]);
      };

      /**
       * Enable or disable events to be generated by the server side for this JSON-RPC session.
       *
       * @example
       * function MyBoardDetectionHandler(name, id, value) {
       *   console.log("Board is detected");
       * }
       * pcm.OnBoardDetected = MyBoardDetectionHandler;
       * pcm.EnableEvents(true).then(console.log("Events are enabled"));
       *
       * @param   {boolean} enable      Enable or disable events.
       * @returns {Promise} In case of success, resolved promise does not contain any data.
       */
      this.EnableEvents = function(enable) {
        return SendRequest.call(this, 'EnableEvents', [enable]);
      };

      /**
       * Subscribe to variable changes at given testing period. When a variable is subscribed, FreeMASTER reads
       * the variable periodically and raises 'OnVariableChanged' event when a value change is detected. The events
       * need to be enabled by calling EnableEvents(true).
       * Event handler should have three parameters: 'name', 'id' and 'value'.
       *
       * @example
       * function MyVariableChangedHandler(name, id, value) {
       *   console.log("Variable " + name + " has changed to value " + value);
       * }
       * pcm.OnVariableChanged = MyVariableChangedHandler;
       * pcm.SubscribeVariable(name).then(console.log("Variable is subscribed"));
       *
       * @param   {string}  name      Variable name.
       * @param   {number}  interval  Testing interval in milliseconds.
       * @returns {Promise} In case of success, resolved promise will contain 'xtra.subscriptionId' member which identifies the subscription.
       */
      this.SubscribeVariable = function(name, interval) {
        return SendRequest.call(this, 'SubscribeVariable', [name, interval]);
      };

      /**
        * Unsubscribe from variable changes subscribed previously with SubscribeVariable.
        *
        * @example
        * pcm.UnsubscribeVariable(name).then(console.log("Variable is un-subscribed"));
        *
        * @param   {string}  name_or_id   Variable name or subscription identifier returned by previous SubscribeVariable call.
        * @returns {Promise} In case of success, resolved promise does not contain any data.
        */
      this.UnSubscribeVariable = function(name_or_id) {
        return SendRequest.call(this, 'UnSubscribeVariable', [name_or_id]);
      };

      /**
       * Define symbol.
       *
       * @example
       * pcm.DefineSymbol(name, address, type, size).then((result) => console.log("Symbol defined"));
       *
       * @param   {string}  name     Symbol name.
       * @param   {string}  address  Address.
       * @param   {string}  type     User type name (e.g. structure type name). Optional, leave empty for generic numeric types.
       * @param   {string}  size     Symbol size. Optional, leave empty to determine automatically when user type is specified.
       * @returns {Promise} In case of success, resolved promise does not contain any data.
       */
      this.DefineSymbol = function(name, address, type, size) {
        return SendRequest.call(this, 'DefineSymbol', [name, address, type, size]);
      };

      /**
       * Retrieve address and size of give symbol.
       *
       * @example
       * pcm.GetSymbolInfo(name).then((result) => console.log("Symbol address=" + result.xtra.addr + " size=" + result.xtra.size));
       *
       * @param   {string}  name   Symbol name.
       * @returns {Promise} In case of success, resolved promise contains 'xtra' object with 'addr' and 'size' members.
       */
      this.GetSymbolInfo = function(name) {
        return SendRequest.call(this, 'GetSymbolInfo', [name]);
      };

      /**
       * Get structure or union member information.
       *
       * @example
       * pcm.GetStructMemberInfo(type, member).then((result) => console.log("Structure type " + type + " member " + member +
       *             " is at offset " + result.xtra.offset + ", size=" + result.xtra.size));
       *
       * @param   {string}  type    User type name.
       * @param   {string}  member  Structure member name.
       * @returns {Promise} In case of success, resolved promise contains 'xtra' object with 'offset' and 'size' members.
       */
      this.GetStructMemberInfo = function(type, member) {
        return SendRequest.call(this, 'GetStructMemberInfo', [type, member]);
      };

      /**
       * Delete all script-defined symbols.
       *
       * @example
       * pcm.DeleteAllScriptSymbols().then((result) => console.log("All script-defined symbols deleted."));
       *
       * @returns {Promise} In case of success, resolved promise does not contain any data.
       */
      this.DeleteAllScriptSymbols = function() {
        return SendRequest.call(this, 'DeleteAllScriptSymbols');
      };

      /**
       * Run variable stimulators.
       *
       * @example
       * pcm.RunStimulators(name).then((result) => console.log("Stimulator " + name + " is now running"));
       *
       * @param   {string}  name  Name of the variable stimulator to start (or more comma-separated names)
       * @returns {Promise} In case of success, resolved promise does not contain any data.
       */
      this.RunStimulators = function(name) {
        return SendRequest.call(this, 'RunStimulators', [name]);
      };

      /**
       * Stop variable stimulators.
       *
       * @example
       * pcm.StopStimulators(name).then((result) => console.log("Stimulator " + name + " is now stopped"));
       *
       * @param   {string}  name  Name of the variable stimulator to stop (or more comma-separated names)
       * @returns {Promise} In case of success, resolved promise does not contain any data.
       */
      this.StopStimulators = function(name) {
        return SendRequest.call(this, 'StopStimulators', [name]);
      };

      /**
       * Exit application.
       *
       * @example
       * pcm.Exit();
       *
       * @returns {Promise} In case of success, resolved promise does not contain any data.
       */
      this.Exit = function() {
        return SendRequest.call(this, 'Exit');
      };

      /**
       * Activate FreeMASTER application window.
       *
       * @example
       * pcm.ActivateWindow();
       *
       * @returns {Promise} In case of success, resolved promise does not contain any data.
       */
      this.ActivateWindow = function() {
        return SendRequest.call(this, 'ActivateWindow');
      };

      /**
       * Select item in FreeMASTER project tree and activate related view.
       *
       * @example
       * pcm.SelectItem("My Oscilloscope", "osc");
       *
       * @param   {string}  name  Name of the item to activate
       * @param   {string}  tab   Tab to activate. Optional, one of the following values: "ctl", "blk", "info", "osc", "rec", "pipe"
       * @returns {Promise} In case of success, resolved promise does not contain any data.
       */
      this.SelectItem = function(name, tab) {
        return SendRequest.call(this, 'SelectItem', [name, tab]);
      };

      /**
       * Open specific FreeMASTER project.
       *
       * @example
       * pcm.OpenProject("C:/projects/my_project.pmpx");
       *
       * @param   {string}  name  Name of the project file to open; use fully qualified name.
       * @returns {Promise} In case of success, resolved promise does not contain any data.
       */
      this.OpenProject = function(name) {
        return SendRequest.call(this, 'OpenProject', [name]);
      };

      /**
       * Determine if board has an active content defined in TSA table.
       *
       * @example
       * pcm.IsBoardWithActiveContent().then((result) => console.log("Board active content " + (result.data ? "is" : "is NOT") + "present"));
       *
       * @returns {Promise} In case of success, resolved promise contains boolean 'data' member with return value.
       */
      this.IsBoardWithActiveContent = function() {
        return SendRequest.call(this, 'IsBoardWithActiveContent');
      };

      /**
       * Enumerate hyperlinks defined by active content.
       *
       * @example
       * for(let index=0; true; index++) {
       *     try {
       *         let response = await pcm.EnumHrefLinks(index);
       *         console.log(response.xtra.name + " " +  response.xtra.retval + "\n");
       *     } catch (err) {
       *         break;
       *     }
       * }
       *
       * @returns {Promise} In case of success, resolved promise contains 'xtra' object with 'name' and 'retval' properties.
       */
      this.EnumHrefLinks = function(index) {
        return SendRequest.call(this, 'EnumHrefLinks', [index]);
      };

      /**
       * Enumerate project files defined by active content.
       *
       * @example
       * for(let index=0; true; index++) {
       *     try {
       *         let response = await pcm.EnumProjectFiles(index);
       *         console.log(response.xtra.name + " " +  response.xtra.retval + "\n");
       *     } catch (err) {
       *         break;
       *     }
       * }
       *
       * @returns {Promise} In case of success, resolved promise contains 'xtra' object with 'name' and 'retval' properties.
       */
      this.EnumProjectFiles = function(index) {
        return SendRequest.call(this, 'EnumProjectFiles', [index]);
      };

      /**
       * Set global flag which affects Control Page reloading after opening port. By default, the page reloads when port is open.
       *
       * @example
       * pcm.SetPageReloadOnPortOpen(false);
       *
       * @returns {Promise} In case of success, resolved promise does not contain any data.
       */
      this.SetPageReloadOnPortOpen = function(value) {
        return SendRequest.call(this, 'SetPageReloadOnPortOpen', [value]);
      };

      /**
       * Get global flag which affects Control Page reloading while opening port.
       *
       * @example
       * pcm.GetPageReloadOnPortOpen().then(result => console.log("PageReloadOnPortOpen flag is " + result.data))
       *
       * @returns {Promise} In case of success, resolved promise contains boolean 'data' member with return value.
       */
      this.GetPageReloadOnPortOpen = function() {
        return SendRequest.call(this, 'GetPageReloadOnPortOpen');
      };

      /**
       * Sets pipes default transmit mode.
       *
       * @example
       * pcm.PipeSetDefaultTxMode(false).then(() => console.log("Default TX mode updated."));
       *
       * @param   {boolean} txAllOrNothing Flag specifying whether the data should be sent all at once.
       * @returns {Promise} The result does not carry any relevant data.
       */
      this.PipeSetDefaultTxMode = function(txAllOrNothing) {
        return SendRequest.call(this, 'PipeSetDefaultTxMode', [txAllOrNothing]);
      };

      /**
       * Get info about variable with address.
       *
       * @example
       * pcm.GetAddressInfo(addr, size).then(() => console.log("Info is " + result.data));
       *
       * @param   {addr} Address of the variable.
       * @param   {size} Size of the variable.
       * @returns {Promise} In case of success, resolved promise contains string 'data' member with return value.
       */
      this.GetAddressInfo = function(addr, size) {
        return SendRequest.call(this, 'GetAddressInfo', [addr, size]);
      };

      /**
       * Define oscilloscope in project.
       *
       * @example
       * pcm.DefineOscilloscope(name, defStr).then(() => console.log("Info is " + result.data));
       *
       * @param   {name} Name of item.
       * @param   {defStr} Stringified JSON definition record. Refer to FreeMASTER documentation for more details.
       * @returns {Promise} The result does not carry any relevant data.
       */
      this.DefineOscilloscope = function(name, defStr) {
        return SendRequest.call(this, 'DefineOscilloscope', [name, defStr]);
      };

      /**
       * Define recorder in project.
       *
       * @example
       * pcm.DefineRecorder(name, defStr).then(() => console.log("Info is " + result.data));
       *
       * @param   {name} Name of item.
       * @param   {defStr} Stringified JSON definition record. Refer to FreeMASTER documentation for more details.
       * @returns {Promise} The result does not carry any relevant data.
       */
      this.DefineRecorder = function(name, defStr) {
        return SendRequest.call(this, 'DefineRecorder', [name, defStr]);
      };

      /**
       * Send application command.
       *
       * @example
       * pcm.SendCommand(send).then(() => console.log("Return is " + result.data));
       *
       * @param   {send} Application command.
       * @param   {wait} Set true to wait for the command processing to finish.
       * @returns {Promise} In case of success, resolved promise contains string 'xtra.message' member with return message and 'xtra.retCode' member with return .
       */
      this.SendCommand = function(send, wait) {
        return SendRequest.call(this, 'SendCommand', [send, wait]);
      };

      /**
       * Get current recorder state.
       *
       * @example
       * pcm.GetCurrentRecorderState().then(() => console.log("Return is " + result.data));
       *
       * @returns {Promise} In case of success, resolved promise contains string 'xtra.data' member with return state.
       */
      this.GetCurrentRecorderState = function() {
        return SendRequest.call(this, 'GetCurrentRecorderState');
      };

      /**
       * Get current recorder data.
       *
       * @example
       * pcm.GetCurrentRecorderData().then(() => console.log("Return is " + result.data));
       *
       * @returns {Promise} In case of success, resolved promise contains string 'xtra.data' member with return data array-of-arrays.
       */
      this.GetCurrentRecorderData = function() {
        return SendRequest.call(this, 'GetCurrentRecorderData');
      };

      /**
       * Get current recorder series.
       *
       * @example
       * pcm.GetCurrentRecorderSeries(name).then(() => console.log("Return is " + result.data));
       *
       * @param   {name} Variable name.
       * @returns {Promise} In case of success, resolved promise contains string 'xtra.data' member with return data array.
       */
      this.GetCurrentRecorderSeries = function(name) {
        return SendRequest.call(this, 'GetCurrentRecorderSeries', [name]);
      };
    };
  };

  if (typeof define == 'function' && define.amd) {
    define('PCM', [], function () {
      return PCM;
    });
  } else if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
    module.exports = PCM;
  } else if (typeof root !== 'undefined') {
    root.PCM = PCM;
  } else {
    return PCM;
  }

})(this);

