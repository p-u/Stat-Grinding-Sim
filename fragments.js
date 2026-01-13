class Shard {
    constructor(x,y) {
        this.x = x; this.y = y;
        this.age = 0; this.maxAge = Math.round((Math.random() * 2) + 3);
        this.basevalue = new Decimal(((Math.random()*0.5)+0.5)*10);
        this.value = this.basevalue;
        this.size = new Decimal(10);
        
        // Visual Props
        this.angle = Math.random() * Math.PI * 2;
        this.points = [];
        this.numPoints = Math.round(Math.random() * 7) + 3; // 3 to 10 sides
        for (let i = 0; i < this.numPoints; i++) {
            const theta = (i / this.numPoints) * Math.PI * 2;
            const r = 0.5 + Math.random() * 0.5; // Irregular radius
            this.points.push({x: Math.cos(theta) * r, y: Math.sin(theta) * r});
        }
        const hue = 250 + Math.random() * 80;     // 250–330
        const saturation = 40 + Math.random() * 40; // 40–80%
        const lightness = 40 + Math.random() * 55;  // 40-95%
        const alpha = Math.random() * 0.5 + 0.5;
        this.color = `hsla(${hue}, ${saturation}%, ${lightness}%, ${alpha})`;

    }
    update(diff) {
        this.age += diff;
        if (this.age >= this.maxAge) {
            return true // despawn
        }
        this.value = this.basevalue.times(this.age/this.maxAge).times(Math.log2(this.numPoints)); // need time to mature, to give the highest value
        this.size = this.size.add((this.age / this.maxAge) * 0.3); 
        return false;
    }
    render(ctx) { // ctx is the 2D canvas
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle + this.age * 0.2); // Slow rotation
        const s = this.size.toNumber() * 3; // Scale up visual size slightly
        ctx.scale(s, s);
        
        ctx.fillStyle = this.color;
        ctx.beginPath();
        if (this.points.length > 0) {
            ctx.moveTo(this.points[0].x, this.points[0].y);
            for (let i = 1; i < this.points.length; i++) {
                ctx.lineTo(this.points[i].x, this.points[i].y);
            }
        }
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = "white";
        ctx.lineWidth = 0.1;
        ctx.stroke();
        
        ctx.restore();
    }
}