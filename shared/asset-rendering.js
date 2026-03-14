(() => {
  const ENVIRONMENT_ASSET_BOUNDS = {
    "assets/environment/container.png": { x: 0.048, y: 0.268, w: 0.905, h: 0.468 },
    "assets/environment/crate.png": { x: 0.23, y: 0.056, w: 0.54, h: 0.887 },
    "assets/environment/metal_barrier.png": { x: 0.035, y: 0.089, w: 0.93, h: 0.825 },
    "assets/environment/warehouse_rooftop.png": { x: 0.062, y: 0.119, w: 0.873, h: 0.772 },
    "assets/environment/security_rooftop.png": { x: 0.232, y: 0.172, w: 0.527, h: 0.644 },
    "assets/environment/logistics_rooftop.png": { x: 0.16, y: 0.136, w: 0.68, h: 0.727 },
  };

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function isRoofAssetPath(asset = "") {
    const lower = String(asset || "").toLowerCase();
    return lower.includes("rooftop") || /(^|[_-])roof([_-]|\.|$)/.test(lower);
  }

  function isLampAssetPath(asset = "") {
    const lower = String(asset || "").toLowerCase();
    return /(lamp|light|floodlight|fixture|sconce|streetlight|spotlight)/.test(lower);
  }

  function getEntityVisualRect(entity, options = {}) {
    if (!entity) {
      return null;
    }

    if (options.decorLike) {
      return {
        x: entity.x,
        y: entity.y,
        w: entity.w || 64,
        h: entity.h || 64,
      };
    }

    if (options.separateBounds === false) {
      return {
        x: entity.x,
        y: entity.y,
        w: entity.w,
        h: entity.h,
      };
    }

    const drawW = typeof entity.drawW === "number" ? entity.drawW : entity.w;
    const drawH = typeof entity.drawH === "number" ? entity.drawH : entity.h;
    const fallbackOffsetX = typeof entity.drawW === "number" ? (entity.w - drawW) * 0.5 : 0;
    const fallbackOffsetY = typeof entity.drawH === "number" ? (entity.h - drawH) * 0.5 : 0;
    return {
      x: entity.x + (typeof entity.drawOffsetX === "number" ? entity.drawOffsetX : fallbackOffsetX),
      y: entity.y + (typeof entity.drawOffsetY === "number" ? entity.drawOffsetY : fallbackOffsetY),
      w: drawW,
      h: drawH,
    };
  }

  function getAssetSourceBounds(asset, image, fallbackProvider = null) {
    if (!asset || !image?.naturalWidth || !image?.naturalHeight) {
      return null;
    }

    const normalized = ENVIRONMENT_ASSET_BOUNDS[asset] || (typeof fallbackProvider === "function" ? fallbackProvider(asset) : null);
    if (!normalized) {
      return null;
    }

    return {
      sx: Math.round(image.naturalWidth * normalized.x),
      sy: Math.round(image.naturalHeight * normalized.y),
      sw: Math.max(1, Math.round(image.naturalWidth * normalized.w)),
      sh: Math.max(1, Math.round(image.naturalHeight * normalized.h)),
    };
  }

  function drawAssetImage(ctx, image, entity, options = {}) {
    if (!ctx || !image?.complete || !image.naturalWidth || !entity) {
      return false;
    }

    const bounds =
      options.rect ||
      getEntityVisualRect(entity, {
        decorLike: Boolean(options.decorLike),
        separateBounds: options.useVisualBounds === false ? false : options.separateBounds,
      });
    if (!bounds) {
      return false;
    }

    const rotation = typeof entity.rotation === "number" ? entity.rotation : 0;
    const baseOpacity = typeof entity.opacity === "number" ? clamp(entity.opacity, 0, 1) : 1;
    const opacity = clamp(baseOpacity * (typeof options.alphaMultiplier === "number" ? options.alphaMultiplier : 1), 0, 1);
    const sourceBounds =
      options.cropToOpaqueBounds === false
        ? null
        : getAssetSourceBounds(entity.asset, image, options.fallbackBoundsProvider || null);

    ctx.save();
    ctx.globalAlpha *= opacity;
    ctx.translate(bounds.x + bounds.w * 0.5, bounds.y + bounds.h * 0.5);
    if (rotation) {
      ctx.rotate(rotation);
    }

    if (sourceBounds) {
      ctx.drawImage(image, sourceBounds.sx, sourceBounds.sy, sourceBounds.sw, sourceBounds.sh, -bounds.w * 0.5, -bounds.h * 0.5, bounds.w, bounds.h);
    } else {
      ctx.drawImage(image, -bounds.w * 0.5, -bounds.h * 0.5, bounds.w, bounds.h);
    }

    ctx.restore();
    return true;
  }

  window.DDDAssetRendering = {
    ENVIRONMENT_ASSET_BOUNDS,
    isRoofAssetPath,
    isLampAssetPath,
    getEntityVisualRect,
    getAssetSourceBounds,
    drawAssetImage,
  };
})();
