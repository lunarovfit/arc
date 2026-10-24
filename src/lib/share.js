// Compartir una imagen (tarjeta de entreno o récord) con la hoja de compartir del móvil.
// La imagen se crea en el propio móvil y no se sube a ningún servidor.
import { Capacitor } from "@capacitor/core";
import { Share } from "@capacitor/share";
import { Filesystem, Directory } from "@capacitor/filesystem";

export async function shareImage(dataUrl, name = "arc.png") {
  if (Capacitor.isNativePlatform()) {
    const data = dataUrl.split(",")[1];
    const res = await Filesystem.writeFile({ path: name, data, directory: Directory.Cache });
    await Share.share({ title: "ARC", files: [res.uri] });
    return;
  }
  const blob = await (await fetch(dataUrl)).blob();
  const file = new File([blob], name, { type: "image/png" });
  if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file] }); return; }
  const a = document.createElement("a"); a.href = dataUrl; a.download = name; a.click();
}
