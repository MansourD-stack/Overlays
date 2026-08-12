import { el } from "@/core/dom";
import { particleBudget } from "@/core/performance";
import type { PerformanceProfile } from "@/types";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  life: number;
  maxLife: number;
}

/**
 * Discrete "sand + spark" particle layer (evokes dunes and welded circuit
 * sparks without ever being loud). Runs on a lightweight Canvas 2D loop and
 * is fully disabled under the "low" performance profile or reduced motion.
 */
export class ParticleField {
  readonly node: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private particles: Particle[] = [];
  private raf = 0;
  private budget = 40;
  private paused = false;
  private ro: ResizeObserver;

  constructor(private color = "var(--glow-color)") {
    this.node = el("canvas", { class: "tg-particle-field" });
    this.ctx = this.node.getContext("2d")!;
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(this.node);
  }

  setProfile(profile: PerformanceProfile, reducedMotion: boolean) {
    this.budget = particleBudget(profile);
    this.paused = reducedMotion || this.budget === 0;
    if (this.paused) {
      this.particles = [];
      this.ctx.clearRect(0, 0, this.node.width, this.node.height);
    }
  }

  start() {
    if (this.raf) return;
    const loop = () => {
      this.raf = requestAnimationFrame(loop);
      if (this.paused) return;
      this.tick();
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.ro.disconnect();
  }

  private resize() {
    const rect = this.node.getBoundingClientRect();
    this.node.width = Math.max(1, rect.width) * devicePixelRatio;
    this.node.height = Math.max(1, rect.height) * devicePixelRatio;
  }

  private spawn() {
    const w = this.node.width;
    const h = this.node.height;
    this.particles.push({
      x: Math.random() * w,
      y: h + 4,
      vx: (Math.random() - 0.5) * 0.15,
      vy: -0.25 - Math.random() * 0.35,
      r: 0.6 + Math.random() * 1.6,
      life: 0,
      maxLife: 260 + Math.random() * 260,
    });
  }

  private tick() {
    if (this.particles.length < this.budget && Math.random() < 0.6) this.spawn();
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.node.width, this.node.height);
    ctx.fillStyle = this.color === "var(--glow-color)"
      ? getComputedStyle(this.node).getPropertyValue("--glow-color").trim() || "#12e19a"
      : this.color;

    this.particles = this.particles.filter((p) => p.life < p.maxLife);
    for (const p of this.particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.life += 1;
      const fade = 1 - p.life / p.maxLife;
      ctx.globalAlpha = Math.max(0, fade) * 0.55;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * devicePixelRatio, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}
