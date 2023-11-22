"use strict";

var HtmlProvider = function (url, trustedHost) {
  this.loaded = false;
  this.counter = 0;
  this.callbacks = {};
  this.url = url || "http://localhost:8545";
  this.trustedHost = trustedHost || this.url;
  this.queue = [];
  this.currentPopup = null;

  var iframeId = "__htmlprovider__";
  var currentIframe = document.getElementById(iframeId);

  if (!currentIframe) {
    currentIframe = document.createElement("iframe");
    document.body.appendChild(currentIframe);
  } else {
    window.removeEventListener("message", currentIframe.htmlProvider);
  }

  this.iframe = currentIframe;
  this.iframe.htmlProvider = this;
  this.iframe.id = iframeId;
  this.iframe.style.display = "none";

  var self = this;

  this.handleEvent = function (event) {
    if (
      event.source != self.currentPopup &&
      event.source != self.iframe.contentWindow
    ) {
      return;
    }
    if (event.type != "message" || event.origin != self.trustedHost) {
      return;
    }

    var data = event.data;
    if (data != "ready") {
      var callback = self.callbacks[data.id];
      delete self.callbacks[data.id];
      callback(data.error, data.result);
    }
  };

  window.addEventListener("message", this);

  this.iframe.onload = function () {
    self.loaded = true;
    var arrayLength = self.queue.length;
    for (var i = 0; i < arrayLength; i++) {
      var data = self.queue[i];
      self.sendAsync(data.payload, data.callback);
    }
    self.queue.length = 0;
  };
  this.iframe.src = this.trustedHost + "/authorization.html";
};

/**
 * @method send not supported
 */
HtmlProvider.prototype.send = function (payload) {
  throw "synchrnous call not supported";
};

/**
 * Should be used to make async request
 *
 * @method sendAsync
 * @param {Object} payload
 * @param {Function} callback triggered on end with (err, result)
 */
HtmlProvider.prototype.sendAsync = function (payload, callback) {
  if (payload.method == "eth_sendTransaction" || payload.method == "eth_sign") {
    var windowWidth = window.outerWidth || document.documentElement.clientWidth;
    var windowHeight =
      window.outerHeight || document.documentElement.clientHeight;
    var w = 600;
    var h = 250;
    var x = window.screenX + windowWidth / 2 - w / 2;
    var y = window.screenY + windowHeight / 2 - h / 2;

    var windowId = "html-provider-window" + window.location.href;
    var popupUrl = this.iframe.src;
    if (this.currentPopup && !this.currentPopup.closed) {
      callback({ message: "existing popup", type: "error" });
      return;
    }
    var popup = window.open(
      popupUrl,
      windowId,
      "left=" +
        x +
        ",top=" +
        y +
        ",width=" +
        w +
        ",height=" +
        h +
        ",toolbar=0,menubar=0,location=1,personalbar=0,dependent=1,minimizable=0,resizable=0,scrollbars=0,chrome=1,dialog=1,modal=1,alwaysRaised=1,close=0"
    );

    this.currentPopup = popup;
    if (popup) {
      var self = this;
      var counter = self.counter;
      self.callbacks[counter] = callback;
      self.counter++;
      var onReady = function (event) {
        if (event.data == "ready") {
          window.removeEventListener("message", onReady);
          popup.postMessage(
            { id: counter, payload: payload, url: self.url },
            self.trustedHost
          );
        }
      };
      window.addEventListener("message", onReady);

      var interval = window.setInterval(function () {
        try {
          if (!self.callbacks[counter]) {
            window.clearInterval(interval);
          } else if (popup == null || popup.closed) {
            self.currentPopup = null;
            self.callbacks[counter]({
              message: "window closed",
              type: "cancel",
            });
            delete self.callbacks[counter];
            window.clearInterval(interval);
          }
        } catch (e) {}
      }, 500);
    } else {
      callback({
        message:
          "ERROR: Couldn't open window to provide authorization at " +
          this.iframe.src,
        type: "error",
      });
    }

    return;
  }

  if (!this.loaded) {
    this.queue.push({ payload: payload, callback: callback });
    return;
  }

  try {
    this.callbacks[this.counter] = callback;
    this.iframe.contentWindow.postMessage(
      { id: this.counter, payload: payload, url: this.url },
      this.trustedHost
    );
    this.counter++;
  } catch (e) {
    callback({
      message:
        "ERROR: Couldn't postMessage to iframe at " + this.iframe.location.href,
      type: "error",
    });
  }
};

/**
 * @method isConnected not supported
 */
HtmlProvider.prototype.isConnected = function () {
  throw "synchrnous call not supported";
};
