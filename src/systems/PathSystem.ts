import { Point2D } from '../types';

export interface PathSegment {
  from: Point2D;
  to: Point2D;
  length: number;
  startDistance: number;
  endDistance: number;
}

export class PathSystem {
  private segments: PathSegment[] = [];
  private totalLength: number = 0;

  constructor(private waypoints: Point2D[]) {
    this.buildSegments();
  }

  private buildSegments(): void {
    this.segments = [];
    let acc = 0;
    for (let i = 0; i < this.waypoints.length - 1; i++) {
      const from = this.waypoints[i];
      const to = this.waypoints[i + 1];
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const len = Math.hypot(dx, dy);
      this.segments.push({
        from,
        to,
        length: len,
        startDistance: acc,
        endDistance: acc + len,
      });
      acc += len;
    }
    this.totalLength = acc;
  }

  public getTotalLength(): number {
    return this.totalLength;
  }

  public getWaypoints(): Point2D[] {
    return this.waypoints;
  }

  public getPositionAtDistance(distance: number): { x: number; y: number; waypointIndex: number; reachedEnd: boolean } {
    if (this.waypoints.length === 0) {
      return { x: 0, y: 0, waypointIndex: 0, reachedEnd: true };
    }
    if (distance <= 0) {
      return { x: this.waypoints[0].x, y: this.waypoints[0].y, waypointIndex: 0, reachedEnd: false };
    }
    if (distance >= this.totalLength) {
      const last = this.waypoints[this.waypoints.length - 1];
      return { x: last.x, y: last.y, waypointIndex: this.waypoints.length - 1, reachedEnd: true };
    }

    for (let i = 0; i < this.segments.length; i++) {
      const seg = this.segments[i];
      if (distance >= seg.startDistance && distance <= seg.endDistance) {
        const t = seg.length > 0 ? (distance - seg.startDistance) / seg.length : 0;
        return {
          x: seg.from.x + (seg.to.x - seg.from.x) * t,
          y: seg.from.y + (seg.to.y - seg.from.y) * t,
          waypointIndex: i,
          reachedEnd: false,
        };
      }
    }

    const last = this.waypoints[this.waypoints.length - 1];
    return { x: last.x, y: last.y, waypointIndex: this.waypoints.length - 1, reachedEnd: true };
  }
}
