import { useEffect, useRef, useState } from "react";
import styles from "./WelcomePage.module.css";

type Point = { x: number; y: number; z: number; tx: number; ty: number; tz: number; color: string };
const rotationSpeed = 0.00051;
const rotationPeriod = Math.PI * 2 / rotationSpeed;

const modelNames = ["C++", "ARCH LINUX", "MINECRAFT", "REDSTONE", "STM32"];

export function PixelAssembly({ active = true, rotationEnabled = true }: { active?: boolean; rotationEnabled?: boolean } = {}) {
  const [shapeIndex, setShapeIndex] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rotationEnabledRef = useRef(false);

  rotationEnabledRef.current = rotationEnabled;

  useEffect(() => {
    if (!active || import.meta.env.MODE === "test") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const points: Point[] = Array.from({ length: 5000 }, (_, index) => ({
      x: Math.sin(index * 91.7) * 260,
      y: Math.cos(index * 47.3) * 180,
      z: Math.sin(index * 19.1) * 180,
      tx: 0,
      ty: 0,
      tz: 0,
      color: "#334155",
    }));
    let width = 0;
    let height = 0;
    let frame = 0;
    let activeShape = -1;
    let assembling = true;
    let rotationTime = 0;
    let lastFrameTime = 0;
    let nextShapeAt = Number.POSITIVE_INFINITY;

    const setTargets = (shape: number) => {
      assembling = true;
      setShapeIndex(shape);
      nextShapeAt = Number.POSITIVE_INFINITY;
      if (shape === 2) {
        const radius = Math.min(width, height) * 0.1175;
        const dirt = ["#986338", "#7b4d2a", "#ad7542", "#694021"];
        const grass = ["#78b84a", "#5f9f3b", "#88c45a", "#4f8b32"];
        points.forEach((point, index) => {
          const face = index % 6;
          const u = pseudoUnit(index, 101);
          const v = pseudoUnit(index, 211);
          if (face === 0 || face === 1) {
            point.tx = face === 0 ? -radius : radius;
            point.ty = u * radius;
            point.tz = v * radius;
          } else if (face === 2 || face === 3) {
            point.tx = u * radius;
            point.ty = face === 2 ? -radius : radius;
            point.tz = v * radius;
          } else {
            point.tx = u * radius;
            point.ty = v * radius;
            point.tz = face === 4 ? -radius : radius;
          }
          const faceU = face === 0 || face === 1 ? v : u;
          const faceV = face === 0 || face === 1 ? u : v;
          const textureX = Math.min(15, Math.floor((faceU + 1) * 8));
          const textureY = Math.min(15, Math.floor((faceV + 1) * 8));
          const palette = face === 2 || (face !== 3 && point.ty < -radius * 0.68) ? grass : dirt;
          point.color = palette[pseudoRandom(textureX, textureY, face * 17 + 5) % palette.length];
        });
        return;
      }

      const targetCanvas = document.createElement("canvas");
      targetCanvas.width = 720;
      targetCanvas.height = 560;
      const targetContext = targetCanvas.getContext("2d");
      if (!targetContext) return;
      drawSymbol(targetContext, shape);
      const pixels = targetContext.getImageData(0, 0, targetCanvas.width, targetCanvas.height).data;
      const candidates: Array<[number, number, string]> = [];
      for (let y = 0; y < targetCanvas.height; y += 3) {
        for (let x = 0; x < targetCanvas.width; x += 3) {
          const offset = (y * targetCanvas.width + x) * 4;
          if (pixels[offset + 3] > 80) candidates.push([x, y, `rgb(${pixels[offset]}, ${pixels[offset + 1]}, ${pixels[offset + 2]})`]);
        }
      }
      const scale = Math.min(width * 0.72 / targetCanvas.width, height * 0.68 / targetCanvas.height);
      points.forEach((point, index) => {
        const candidate = candidates[Math.floor(index * candidates.length / points.length)] ?? [targetCanvas.width / 2, targetCanvas.height / 2, "#334155"];
        point.tx = (candidate[0] - targetCanvas.width / 2) * scale;
        point.ty = (candidate[1] - targetCanvas.height / 2) * scale;
        point.tz = (pseudoRandom(index, shape, 83) % 37) - 18;
        point.color = candidate[2];
      });
    };

    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
      width = bounds.width;
      height = bounds.height;
      canvas.width = Math.max(1, Math.round(width * ratio));
      canvas.height = Math.max(1, Math.round(height * ratio));
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      activeShape = -1;
      // Resizing clears the canvas; reduced motion still needs one fresh frame.
      if (reducedMotion) {
        window.cancelAnimationFrame(frame);
        frame = window.requestAnimationFrame(draw);
      }
    };

    const draw = (time: number) => {
      const delta = lastFrameTime ? Math.min(40, time - lastFrameTime) : 0;
      lastFrameTime = time;
      if (activeShape < 0) {
        activeShape = 0;
        setTargets(activeShape);
      }
      const canRotate = !reducedMotion && rotationEnabledRef.current && !assembling;
      if (canRotate) {
        rotationTime += delta;
        if (!Number.isFinite(nextShapeAt)) nextShapeAt = time + rotationPeriod;
        if (time >= nextShapeAt) {
          activeShape = (activeShape + 1) % 5;
          setTargets(activeShape);
        }
      }

      context.clearRect(0, 0, width, height);
      const rotationY = reducedMotion ? 0 : rotationTime * rotationSpeed;
      const rotationX = reducedMotion ? 0 : Math.sin(rotationTime * 0.00048) * 0.16;
      const cosineY = Math.cos(rotationY);
      const sineY = Math.sin(rotationY);
      const cosineX = Math.cos(rotationX);
      const sineX = Math.sin(rotationX);
      const floatY = reducedMotion ? 0 : Math.sin(time * 0.00105) * 18;

      let remainingDistance = 0;
      points.forEach((point) => {
        point.x += (point.tx - point.x) * (reducedMotion ? 1 : 0.045);
        point.y += (point.ty - point.y) * (reducedMotion ? 1 : 0.045);
        point.z += (point.tz - point.z) * (reducedMotion ? 1 : 0.045);
        remainingDistance += Math.abs(point.tx - point.x) + Math.abs(point.ty - point.y) + Math.abs(point.tz - point.z);
        const rotatedX = point.x * cosineY - point.z * sineY;
        const firstZ = point.x * sineY + point.z * cosineY;
        const rotatedY = point.y * cosineX - firstZ * sineX;
        const rotatedZ = point.y * sineX + firstZ * cosineX;
        const scale = 420 / (520 + rotatedZ);
        const size = Math.max(1.2, 3.2 * scale);
        context.globalAlpha = Math.max(0.22, Math.min(0.82, scale * 0.75));
        context.fillStyle = point.color;
        context.fillRect(width / 2 + rotatedX * scale, height / 2 + floatY + rotatedY * scale, size, size);
      });
      if (assembling && (reducedMotion || (rotationEnabledRef.current && remainingDistance / points.length < 0.8))) {
        assembling = false;
      }
      context.globalAlpha = 1;

      if (!reducedMotion && !document.hidden) frame = window.requestAnimationFrame(draw);
    };

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();
    frame = window.requestAnimationFrame(draw);

    const onVisibilityChange = () => {
      window.cancelAnimationFrame(frame);
      if (!document.hidden && !reducedMotion) frame = window.requestAnimationFrame(draw);
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.cancelAnimationFrame(frame);
    };
  }, [active]);

  return <div className={styles.modelScene}>
    <span className={styles.modelContent}>
      <span className={styles.modelGrid} aria-hidden="true" />
      <canvas ref={canvasRef} className={styles.pixelCanvas} aria-hidden="true" />
    </span>
    <div className={styles.modelAnnotation}>
      <svg viewBox="0 0 48 48" aria-hidden="true"><path d="M2 46H16L47 1H48" /><circle cx="2" cy="46" r="2" /></svg>
      <b>{modelNames[shapeIndex]}</b>
      <svg className={styles.annotationUnderline} viewBox="0 0 100 2" preserveAspectRatio="none" aria-hidden="true"><path d="M0 1H100" /></svg>
    </div>
  </div>;
}

function drawSymbol(context: CanvasRenderingContext2D, shape: number) {
  if (shape === 0) {
    drawCppLogo(context);
    return;
  }

  if (shape === 1) {
    const archMark = new Path2D("M105.8125 16.625C98.41563 34.76016 93.9542 46.62268 85.71875 64.21875C90.76811 69.57107 96.96596 75.80411 107.03125 82.84375C96.21008 78.3909 88.82871 73.92035 83.3125 69.28125C72.7727 91.27416 56.25986 122.60209 22.75 182.8125C49.08763 167.60733 69.50409 158.23318 88.53125 154.65625C87.71422 151.1422 87.2497 147.34107 87.28125 143.375L87.3125 142.53125C87.73042 125.65743 96.50817 112.68146 106.90625 113.5625C117.30434 114.44354 125.38666 128.84492 124.96875 145.71875C124.89015 148.89387 124.532 151.9483 123.90625 154.78125C142.72683 158.46289 162.92498 167.81304 188.90625 182.8125C183.78325 173.3807 179.21053 164.87861 174.84375 156.78125C167.96536 151.45004 160.79086 144.51145 146.15625 137C156.21524 139.61375 163.41735 142.62932 169.03125 146C124.63297 63.33816 121.03766 52.35411 105.8125 16.625Z");
    context.fillStyle = "#1793d1";
    context.save();
    context.translate(79, 16);
    context.scale(2.65, 2.65);
    context.fill(archMark);
    context.restore();
    return;
  }

  if (shape === 3) {
    drawRedstoneItem(context);
    return;
  }

  context.fillStyle = "#0875b9";
  context.beginPath();
  context.arc(360, 280, 225, 0, Math.PI * 2);
  context.fill();
  context.globalCompositeOperation = "destination-out";
  context.beginPath();
  context.moveTo(350, 275);
  context.bezierCurveTo(315, 170, 205, 132, 210, 230);
  context.bezierCurveTo(214, 300, 286, 327, 347, 292);
  context.bezierCurveTo(300, 315, 260, 370, 285, 418);
  context.bezierCurveTo(330, 402, 350, 345, 360, 300);
  context.bezierCurveTo(370, 345, 390, 402, 435, 418);
  context.bezierCurveTo(460, 370, 420, 315, 373, 292);
  context.bezierCurveTo(434, 327, 506, 300, 510, 230);
  context.bezierCurveTo(515, 132, 405, 170, 370, 275);
  context.closePath();
  context.fill();
  context.globalCompositeOperation = "source-over";
}

function drawCppLogo(context: CanvasRenderingContext2D) {
  const scale = 1.36;
  context.save();
  context.translate((720 - 306 * scale) / 2, (560 - 344.35 * scale) / 2);
  context.scale(scale, scale);

  context.fillStyle = "#00599C";
  context.fill(new Path2D("M302.107 258.262c2.401-4.159 3.893-8.845 3.893-13.053V99.14c0-4.208-1.49-8.893-3.892-13.052L153 172.175l149.107 86.087z"));
  context.fillStyle = "#004482";
  context.fill(new Path2D("M166.25 341.193l126.5-73.034c3.644-2.104 6.956-5.737 9.357-9.897L153 172.175 3.893 258.263c2.401 4.159 5.714 7.793 9.357 9.896l126.5 73.034c7.287 4.208 19.213 4.208 26.5 0z"));
  context.fillStyle = "#659AD2";
  context.fill(new Path2D("M302.108 86.087c-2.402-4.16-5.715-7.793-9.358-9.897L166.25 3.156c-7.287-4.208-19.213-4.208-26.5 0L13.25 76.19C5.962 80.397 0 90.725 0 99.14v146.069c0 4.208 1.491 8.894 3.893 13.053L153 172.175l149.108-86.088z"));
  context.fillStyle = "#FFFFFF";
  context.fill(new Path2D("M153 274.175c-56.243 0-102-45.757-102-102s45.757-102 102-102c36.292 0 70.139 19.53 88.331 50.968l-44.143 25.544c-9.105-15.736-26.038-25.512-44.188-25.512-28.122 0-51 22.878-51 51 0 28.121 22.878 51 51 51 18.152 0 35.085-9.776 44.191-25.515l44.143 25.543C223.142 254.644 189.294 274.175 153 274.175z"));
  context.fill(new Path2D("M255 166.508h-11.334v-11.333h-11.332v11.333H221v11.333h11.334v11.334h11.332v-11.334H255z"));
  context.fill(new Path2D("M297.5 166.508h-11.334v-11.333h-11.332v11.333H263.5v11.333h11.334v11.334h11.332v-11.334H297.5z"));
  context.restore();
}

function pseudoRandom(x: number, y: number, seed: number) {
  return Math.abs(Math.imul(x + seed, 73856093) ^ Math.imul(y + seed, 19349663));
}

function pseudoUnit(index: number, seed: number) {
  const value = pseudoRandom(index, index * 3 + seed, seed) % 10000;
  return value / 4999.5 - 1;
}

function drawRedstoneItem(context: CanvasRenderingContext2D) {
  const sprite = [
    "................", "................", "................", ".......AA.......",
    "......ABCA......", ".....ACDCEF.....", "....ACDCBDEF....", "...ACCCDCEAEF...",
    "..ABDCBEDBECGF..", "..ACBCDCBEEAEF..", "..FECDCBECEEGF..", "...FECBEAEEGF...",
    "....FFGEEGFF....", "......FFFF......", "................", "................",
  ];
  const palette: Record<string, string> = {
    A: "#5c0700", B: "#720000", C: "#aa0f01", D: "#ff0000",
    E: "#410500", F: "#2d0000", G: "#340605",
  };
  const pixel = 28;
  const offsetX = (720 - sprite[0].length * pixel) / 2;
  const offsetY = (560 - sprite.length * pixel) / 2;
  sprite.forEach((row, y) => {
    [...row].forEach((value, x) => {
      if (value === ".") return;
      context.fillStyle = palette[value];
      context.fillRect(offsetX + x * pixel, offsetY + y * pixel, pixel, pixel);
    });
  });
}
