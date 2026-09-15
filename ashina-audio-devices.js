/* ASHINA Audio Device Manager 1.0
 * Peripheral audio routing for phone, Bluetooth headsets and external microphones.
 * Browser-safe: uses only APIs exposed by Android/Chrome.
 */

(function () {
  "use strict";

  const BT_WORDS =
    /bluetooth|airpods|buds|headset|headphone|earbuds|wireless|tws|hands[- ]?free|гарнитур|наушник|беспровод/i;

  const MIC_WORDS =
    /mic|microphone|input|гарнитур|наушник|buds|airpods|headset|micro/i;

  function supported() {
    return !!(
      navigator.mediaDevices &&
      navigator.mediaDevices.getUserMedia &&
      navigator.mediaDevices.enumerateDevices
    );
  }

  function isBluetoothLabel(label) {
    return BT_WORDS.test(label || "");
  }

  function classify(device) {
    const label = device?.label || "";

    if (
      device?.kind === "audioinput" &&
      isBluetoothLabel(label)
    ) {
      return "bluetooth-input";
    }

    if (
      device?.kind === "audiooutput" &&
      isBluetoothLabel(label)
    ) {
      return "bluetooth-output";
    }

    if (device?.kind === "audioinput") {
      return "microphone";
    }

    if (device?.kind === "audiooutput") {
      return "speaker";
    }

    return "other";
  }

  async function list() {
    if (!supported()) {
      return [];
    }

    try {
      const devices =
        await navigator.mediaDevices.enumerateDevices();

      return devices.map(function (device) {
        return {
          deviceId: device.deviceId,
          groupId: device.groupId,
          kind: device.kind,
          label: device.label || "",
          type: classify(device)
        };
      });
    } catch (error) {
      console.warn(
        "ASHINA Audio Device Manager: enumerateDevices failed",
        error
      );

      return [];
    }
  }

  async function requestPermission() {
    if (!supported()) {
      throw new Error("MEDIA_DEVICES_UNSUPPORTED");
    }

    const stream =
      await navigator.mediaDevices.getUserMedia({
        audio: true
      });

    stream.getTracks().forEach(function (track) {
      try {
        track.stop();
      } catch (_) {}
    });

    return list();
  }

  async function findBluetoothInput() {
    const devices = await list();

    return (
      devices.find(function (device) {
        return (
          device.kind === "audioinput" &&
          device.type === "bluetooth-input"
        );
      }) || null
    );
  }

  async function getPreferredInput() {
    const bluetooth =
      await findBluetoothInput();

    if (bluetooth) {
      return bluetooth;
    }

    const devices = await list();

    return (
      devices.find(function (device) {
        return (
          device.kind === "audioinput" &&
          device.deviceId
        );
      }) || null
    );
  }

  async function openInput(deviceId, baseConstraints) {
    const constraints = Object.assign(
      {},
      baseConstraints || {}
    );

    if (deviceId) {
      constraints.deviceId = {
        exact: deviceId
      };
    }

    return navigator.mediaDevices.getUserMedia({
      audio: constraints
    });
  }

  function getDeviceLabel(stream) {
    try {
      const tracks =
        stream?.getAudioTracks?.();

      if (!tracks || !tracks.length) {
        return "";
      }

      return tracks[0].label || "";
    } catch (_) {
      return "";
    }
  }

  function isBluetoothStream(stream) {
    return isBluetoothLabel(
      getDeviceLabel(stream)
    );
  }

  async function chooseBestInput(baseConstraints) {
    if (!supported()) {
      return {
        stream: null,
        device: null,
        bluetooth: false
      };
    }

    /*
     * First open the browser-selected microphone.
     * This grants microphone permission and usually
     * exposes the real device labels.
     */

    let stream =
      await navigator.mediaDevices.getUserMedia({
        audio: baseConstraints || true
      });

    let currentLabel =
      getDeviceLabel(stream);

    /*
     * Now inspect available audio inputs.
     */

    let devices = await list();

    let bluetoothInput =
      devices.find(function (device) {
        return (
          device.kind === "audioinput" &&
          device.type === "bluetooth-input"
        );
      });

    /*
     * If Android/Chrome exposes a Bluetooth microphone,
     * try to select it explicitly.
     */

    if (
      bluetoothInput &&
      !isBluetoothLabel(currentLabel) &&
      bluetoothInput.deviceId
    ) {
      try {
        stream.getTracks().forEach(function (track) {
          try {
            track.stop();
          } catch (_) {}
        });

        stream =
          await openInput(
            bluetoothInput.deviceId,
            baseConstraints
          );

        currentLabel =
          getDeviceLabel(stream);

      } catch (error) {
        /*
         * Bluetooth selection can be rejected by the
         * browser or Android. Never break recording.
         */

        console.warn(
          "ASHINA: Bluetooth input could not be selected explicitly; keeping default input.",
          error
        );

        stream =
          await navigator.mediaDevices.getUserMedia({
            audio: baseConstraints || true
          });

        currentLabel =
          getDeviceLabel(stream);
      }
    }

    const audioTrack =
      stream.getAudioTracks?.()[0];

    let settings = {};

    try {
      settings =
        audioTrack?.getSettings?.() || {};
    } catch (_) {}

    const selectedDeviceId =
      settings.deviceId || "";

    const device =
      devices.find(function (item) {
        return (
          item.kind === "audioinput" &&
          item.label === currentLabel
        );
      }) ||
      devices.find(function (item) {
        return (
          item.kind === "audioinput" &&
          item.deviceId === selectedDeviceId
        );
      }) ||
      null;

    return {
      stream: stream,
      device: device,
      bluetooth:
        isBluetoothLabel(currentLabel),
      label: currentLabel,
      devices: devices
    };
  }

  /*
   * Public ASHINA Audio Device API.
   */

  window.ASHINA_AUDIO_DEVICES = {
    version: "1.0",

    supported: supported,

    list: list,

    requestPermission: requestPermission,

    findBluetoothInput:
      findBluetoothInput,

    getPreferredInput:
      getPreferredInput,

    openInput:
      openInput,

    chooseBestInput:
      chooseBestInput,

    getDeviceLabel:
      getDeviceLabel,

    isBluetoothStream:
      isBluetoothStream,

    isBluetoothLabel:
      isBluetoothLabel
  };

})();
