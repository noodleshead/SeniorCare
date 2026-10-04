import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { X, Camera, AlertCircle, Loader2 } from "lucide-react";
import { COLORS } from "./theme.js";

/**
 * Camera-based QR scanner modal.
 *
 * Scanning only ever extracts the QR payload (the raw text encoded in
 * the code) — it never decides anything about validity or claim status.
 * That payload is handed to `onDetected`, which is responsible for
 * sending it to the existing backend resolve endpoint; this component
 * has no opinion about what happens after a QR is found.
 *
 * Camera lifecycle: the stream is only ever created in the effect below
 * and is always stopped in that same effect's cleanup — on unmount, on
 * close, and before ever creating a second stream — so the camera is
 * never left running in the background.
 */
export default function QrScannerDialog({ onDetected, onClose }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(document.createElement("canvas"));
  const streamRef = useRef(null);
  const rafRef = useRef(null);
  const hasDetectedRef = useRef(false);

  const [status, setStatus] = useState("requesting"); // requesting | scanning | error
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    function stopCamera() {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    }

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus("error");
        setErrorMessage("Your browser doesn't support camera access. Please use the manual entry field instead.");
        return;
      }
      if (!window.isSecureContext) {
        setStatus("error");
        setErrorMessage("Camera access requires a secure (HTTPS) connection. Please use the manual entry field instead.");
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setStatus("scanning");
        tick();
      } catch (err) {
        if (cancelled) return;
        setStatus("error");
        if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
          setErrorMessage("Camera access is required to scan a QR code. Please allow camera access in your browser settings.");
        } else if (err.name === "NotFoundError" || err.name === "OverconstrainedError") {
          setErrorMessage("No camera was found on this device.");
        } else if (err.name === "NotReadableError") {
          setErrorMessage("The camera is already in use by another application.");
        } else {
          setErrorMessage("We couldn't start the camera. Please try again or use the manual entry field.");
        }
      }
    }

    function tick() {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || video.readyState !== video.HAVE_ENOUGH_DATA) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: "dontInvert",
      });

      if (code && code.data && !hasDetectedRef.current) {
        // Stop scanning immediately so the same QR can't fire twice and
        // so the camera isn't left running while the payload is verified.
        hasDetectedRef.current = true;
        stopCamera();
        onDetected(code.data);
        return;
      }

      rafRef.current = requestAnimationFrame(tick);
    }

    start();

    return () => {
      cancelled = true;
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-labelledby="qr-scanner-title">
      <div className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 relative">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close scanner"
          className="absolute top-3 right-3 w-11 h-11 rounded-full flex items-center justify-center hover:bg-slate-100 focus:outline-none focus-visible:ring-2"
          style={{ color: COLORS.yale }}
        >
          <X className="w-6 h-6" aria-hidden="true" />
        </button>

        <h3 id="qr-scanner-title" className="text-lg font-extrabold text-center mb-4" style={{ color: COLORS.yale }}>
          Scan Claiming QR
        </h3>

        <div
          className="relative w-full aspect-square rounded-xl overflow-hidden flex items-center justify-center"
          style={{ backgroundColor: COLORS.yale }}
        >
          {status === "requesting" && (
            <div className="flex flex-col items-center gap-2 text-white">
              <Loader2 className="w-8 h-8 animate-spin" aria-hidden="true" />
              <p className="text-sm font-semibold">Requesting camera access...</p>
            </div>
          )}

          {status === "error" && (
            <div className="flex flex-col items-center gap-2 text-center px-6 text-white">
              <AlertCircle className="w-8 h-8" aria-hidden="true" />
              <p className="text-sm font-semibold">{errorMessage}</p>
            </div>
          )}

          {/* Always mounted (not just when scanning) so the ref exists before getUserMedia resolves. */}
          <video
            ref={videoRef}
            muted
            playsInline
            className="w-full h-full object-cover"
            style={{ display: status === "scanning" ? "block" : "none" }}
          />

          {status === "scanning" && (
            <div className="absolute inset-8 border-4 rounded-lg pointer-events-none" style={{ borderColor: COLORS.sky }} />
          )}
        </div>

        <p className="text-sm text-center mt-4" style={{ color: COLORS.yale }}>
          {status === "scanning"
            ? "Point the camera at the Senior's claiming QR code."
            : status === "error"
            ? "You can close this and use the manual entry field instead."
            : "Please allow camera access to continue."}
        </p>

        <button
          type="button"
          onClick={onClose}
          className="w-full mt-4 inline-flex items-center justify-center gap-2 rounded-md px-5 py-2.5 font-semibold text-white"
          style={{ backgroundColor: COLORS.baltic }}
        >
          <Camera className="w-4 h-4" aria-hidden="true" /> Close
        </button>
      </div>
    </div>
  );
}
