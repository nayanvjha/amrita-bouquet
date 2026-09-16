/** The opening card. Two quiet choices; the camera is never forced. */
export class Intro {
  private root = document.getElementById('intro')!;
  private cameraButton = document.getElementById('btn-camera') as HTMLButtonElement;
  private noCameraButton = document.getElementById('btn-nocam') as HTMLButtonElement;

  constructor(onCamera: () => void, onWithout: () => void) {
    const hasCamera = !!navigator.mediaDevices?.getUserMedia && (window.isSecureContext || location.hostname === 'localhost');
    if (!hasCamera) this.cameraButton.style.display = 'none';
    this.cameraButton.addEventListener('click', () => { this.setBusy(true); onCamera(); });
    this.noCameraButton.addEventListener('click', onWithout);
  }

  setBusy(busy: boolean) {
    this.cameraButton.disabled = busy;
    this.cameraButton.textContent = busy ? 'One moment…' : 'Enable camera';
  }

  hide() { this.root.classList.add('is-hidden'); }
  show() { this.root.classList.remove('is-hidden'); this.setBusy(false); }
}
