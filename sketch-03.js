const canvasSketch = require('canvas-sketch');
const random = require('canvas-sketch-util/random');
const math = require('canvas-sketch-util/math');

const settings = {
  dimensions: [1080, 1350], // Instagram-friendly portrait aspect ratio (4:5)
  animate: true,
  fps: 60, // Max FPS for Instagram
  exportPixelRatio: 2, // High-quality export
  // Removed duration to allow for infinite looping
};

const INITIAL_POINTS = 200; // Start with an initial set of points
const THOUGHTS_PER_SECOND = 0.8; // Balanced generation of new thoughts
const POINT_LIFESPAN = 120; // Lifespan of 2 minutes for thoughts to live longer
const MIN_ACTIVE_POINTS = 150; // Ensure a stable minimum number of points

const sketch = ({ context, width, height }) => {
  let points = [];

  // Initialize with a large set of points
  for (let i = 0; i < INITIAL_POINTS; i++) {
    const x = random.range(0, width);
    const y = random.range(0, height);
    points.push(new Point(x, y));
  }

  return ({ context, width, height, time }) => {
    // Fading effect for the background
    context.fillStyle = 'rgba(1, 1, 1, 0.1)';
    context.fillRect(0, 0, width, height);

    // Ensure a minimum number of points always exist
    while (points.length < MIN_ACTIVE_POINTS) {
      const x = random.range(0, width);
      const y = random.range(0, height);
      points.push(new Point(x, y));
    }

    // Generate new thoughts slowly and continuously
    if (random.chance(THOUGHTS_PER_SECOND / 60)) {
      const x = random.range(0, width);
      const y = random.range(0, height);
      points.push(new Point(x, y));
    }

    // Draw connections between points
    const dynamicThreshold = math.mapRange(Math.sin(time * 0.5), -1, 1, 100, 150);

    for (let i = 0; i < points.length; i++) {
      const p1 = points[i];

      for (let j = i + 1; j < points.length; j++) {
        const p2 = points[j];
        const dist = p1.pos.getDistance(p2.pos);

        if (dist > dynamicThreshold) continue;

        const alpha = math.mapRange(dist, 0, dynamicThreshold, 0.6, 0);
        context.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
        context.lineWidth = math.mapRange(dist, 0, dynamicThreshold, 1.5, 0.5);
        context.beginPath();
        context.moveTo(p1.pos.x, p1.pos.y);
        context.lineTo(p2.pos.x, p2.pos.y);
        context.stroke();
      }
    }

    // Update and draw points
    points.forEach((point, index) => {
      point.update(width, height, time);
      point.draw(context);
      point.age += 1 / settings.fps;

      // Remove points that exceed their lifespan
      if (point.age >= POINT_LIFESPAN) {
        points.splice(index, 1); // Remove the point
      }
    });

  };
};

canvasSketch(sketch, settings);

class Vector {
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }

  getDistance(v) {
    const dx = this.x - v.x;
    const dy = this.y - v.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  subtract(v) {
    return new Vector(this.x - v.x, this.y - v.y);
  }

  add(v) {
    return new Vector(this.x + v.x, this.y + v.y);
  }

  scale(scalar) {
    return new Vector(this.x * scalar, this.y * scalar);
  }

  length() {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }

  normalize() {
    const len = this.length();
    return new Vector(this.x / len, this.y / len);
  }
}

class Point {
  constructor(x, y) {
    this.pos = new Vector(x, y);
    this.vel = new Vector(random.range(-0.2, 0.2), random.range(-0.2, 0.2)); 
    this.acc = new Vector(0, 0);
    this.radius = 3;
    this.age = 0; // Track the lifespan of the point
  }

  applyBoundaries(width, height) {
    const margin = 100;
    if (this.pos.x < margin) this.vel.x += 0.01;
    if (this.pos.x > width - margin) this.vel.x -= 0.01;
    if (this.pos.y < margin) this.vel.y += 0.01;
    if (this.pos.y > height - margin) this.vel.y -= 0.01;
  }

  update(width, height, time) {
    this.applyBoundaries(width, height);
    this.vel.x += Math.sin(time * 0.2 + this.pos.y * 0.5) * 0.02;
    this.vel.y += Math.cos(time * 0.2 + this.pos.x * 0.5) * 0.02;
    this.vel.x += random.range(-0.005, 0.005);
    this.vel.y += random.range(-0.005, 0.005);
    this.pos = this.pos.add(this.vel);

    const speedLimit = 0.4;
    this.vel.x = math.clamp(this.vel.x, -speedLimit, speedLimit);
    this.vel.y = math.clamp(this.vel.y, -speedLimit, speedLimit);

    if (this.pos.x < 0) this.pos.x = width;
    if (this.pos.x > width) this.pos.x = 0;
    if (this.pos.y < 0) this.pos.y = height;
    if (this.pos.y > height) this.pos.y = 0;
  }

  draw(context) {
    const alpha = math.mapRange(this.age, 0, POINT_LIFESPAN, 1, 0);
    context.save();
    context.translate(this.pos.x, this.pos.y);
    context.fillStyle = `rgba(255, 255, 255, ${alpha})`;
    context.beginPath();
    context.arc(0, 0, this.radius, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }
}