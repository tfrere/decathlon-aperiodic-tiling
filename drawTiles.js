function sketch(parent) {
  return function (p) {
    let canvas;
    let preFactor;
    let rotate;
    let pan;

    let selectedTile = {};
    let recentHover = true;
    let recentlySelectedTiles = [];
    let adding = true;

    let prevX = 0;
    let prevY = 0;

    p.setup = function () {
      let target = parent.$el.parentElement;
      let width = target.clientWidth;
      let height = target.clientHeight;

      canvas = p.createCanvas(width, height);
      canvas.parent(parent.$el);
      parent.$emit("update:resize-completed");
      parent.$emit("update:width", width);
      parent.$emit("update:height", height);

      p.pixelDensity(2);
      p.noLoop();
      drawTiles(p, parent.data);
    };

    p.draw = function () {};

    p.dataChanged = function (data, oldData) {
      if (data.display == "none") {
        let target = parent.$el.parentElement;
        let width = target.clientWidth;
        let height = target.clientHeight;
        p.resizeCanvas(width, height);
        parent.$emit("update:resize-completed");
        parent.$emit("update:width", width);
        parent.$emit("update:height", height);
      }

      if (data.download > oldData.download) {
        generateAndDownloadSVG(parent.data);
      }

      drawTiles(p, data);
    };

    p.mouseDragged = function () {
      if (
        p.mouseX > 0 &&
        p.mouseX < p.width &&
        p.mouseY > 0 &&
        p.mouseY < p.height
      ) {
        recentHover = true;

        let xprime =
          (p.mouseX - (p.width / 2 + pan)) * Math.cos(-rotate) -
          (p.mouseY - p.height / 2) * Math.sin(-rotate);
        let yprime =
          (p.mouseX - (p.width / 2 + pan)) * Math.sin(-rotate) +
          (p.mouseY - p.height / 2) * Math.cos(-rotate);

        selectedTile = getSelectedTile(xprime, yprime);

        drawTiles(p, parent.data);

        if (Object.keys(selectedTile).length > 0) {
          let tileString = tileToString(selectedTile);
          if (!recentlySelectedTiles.includes(tileString)) {
            updateSelectedTiles(selectedTile, adding);
            recentlySelectedTiles.push(tileString);
          }
        }

        let mouseDistance = p.dist(p.mouseX, p.mouseY, prevX, prevY);
        let stepSize = p.max(1, preFactor / 10);

        if (mouseDistance > stepSize) {
          for (let i = 0; i <= mouseDistance; i += stepSize) {
            let cursorX = p.map(i, 0, mouseDistance, p.mouseX, prevX, true);
            let cursorY = p.map(i, 0, mouseDistance, p.mouseY, prevY, true);

            let xprime =
              (cursorX - (p.width / 2 + pan)) * Math.cos(-rotate) -
              (cursorY - p.height / 2) * Math.sin(-rotate);
            let yprime =
              (cursorX - (p.width / 2 + pan)) * Math.sin(-rotate) +
              (cursorY - p.height / 2) * Math.cos(-rotate);
            let intermediateTile = getSelectedTile(xprime, yprime);

            if (Object.keys(intermediateTile).length > 0) {
              let tileString = tileToString(intermediateTile);
              if (!recentlySelectedTiles.includes(tileString)) {
                updateSelectedTiles(intermediateTile, adding);
                recentlySelectedTiles.push(tileString);
              }
            }
          }
        }

        prevX = p.mouseX;
        prevY = p.mouseY;
      }
    };

    p.mouseMoved = function () {
      if (
        p.mouseX > 0 &&
        p.mouseX < p.width &&
        p.mouseY > 0 &&
        p.mouseY < p.height
      ) {
        recentHover = true;

        let xprime =
          (p.mouseX - (p.width / 2 + pan)) * Math.cos(-rotate) -
          (p.mouseY - p.height / 2) * Math.sin(-rotate);
        let yprime =
          (p.mouseX - (p.width / 2 + pan)) * Math.sin(-rotate) +
          (p.mouseY - p.height / 2) * Math.cos(-rotate);

        selectedTile = getSelectedTile(xprime, yprime);

        drawTiles(p, parent.data);

        if (Object.keys(selectedTile).length > 0) {
          p.push();
          p.translate(p.width / 2 + pan, p.height / 2);
          p.fill(128, 215, 255);
          p.rotate(rotate);
          p.beginShape();
          for (let pt of selectedTile.dualPts) {
            p.vertex(preFactor * pt.x, preFactor * pt.y);
          }
          p.endShape(p.CLOSE);
          p.pop();
        }

        prevX = p.mouseX;
        prevY = p.mouseY;
      } else if (recentHover) {
        recentHover = false;
        drawTiles(p, parent.data);
      }
    };

    p.mousePressed = function () {
      if (
        p.mouseX > 0 &&
        p.mouseX < p.width &&
        p.mouseY > 0 &&
        p.mouseY < p.height
      ) {
        let xprime =
          (p.mouseX - (p.width / 2 + pan)) * Math.cos(-rotate) -
          (p.mouseY - p.height / 2) * Math.sin(-rotate);
        let yprime =
          (p.mouseX - (p.width / 2 + pan)) * Math.sin(-rotate) +
          (p.mouseY - p.height / 2) * Math.cos(-rotate);

        selectedTile = getSelectedTile(xprime, yprime);

        if (Object.keys(selectedTile).length > 0) {
          let tileString = tileToString(selectedTile);

          if (!recentlySelectedTiles.includes(tileString)) {
            let index = parent.data.selectedTiles.findIndex(
              (e) => e.x == selectedTile.x && e.y == selectedTile.y
            );
            adding = index < 0;
            updateSelectedTiles(selectedTile, adding);
            recentlySelectedTiles.push(tileString);
          }
        }

        prevX = p.mouseX;
        prevY = p.mouseY;
      }
    };

    p.mouseReleased = function () {
      recentlySelectedTiles = [];
    };

    function getSelectedTile(mouseX, mouseY) {
      let x = mouseX / preFactor;
      let y = mouseY / preFactor;

      let inside = false;
      let mySelectedTile = {};

      let nearbyTiles = Object.values(parent.data.tiles).filter(
        (e) => p.dist(x, y, e.mean.x, e.mean.y) < 1
      );

      for (let tile of nearbyTiles) {
        if (!inside) {
          let vertices = tile.dualPts;
          let numVertices = vertices.length;

          let a = whichSide(
            x,
            y,
            vertices[0].x,
            vertices[0].y,
            vertices[1].x,
            vertices[1].y
          );
          inside = true;

          for (let i = 1; i < numVertices; i++) {
            if (
              a !==
              whichSide(
                x,
                y,
                vertices[i].x,
                vertices[i].y,
                vertices[(i + 1) % numVertices].x,
                vertices[(i + 1) % numVertices].y
              )
            ) {
              inside = false;
            }
          }

          if (inside) {
            mySelectedTile = tile;
          }
        }
      }

      return mySelectedTile;
    }

    function updateSelectedTiles(tile, addMode) {
      if (addMode) {
        parent.$emit("update:add-tile", tile);
      } else {
        parent.$emit("update:remove-tile", tile);
      }
    }

    function drawTiles(instance, data) {
      let steps = data.steps;
      let multiplier = data.multiplier;
      let spacing = instance.min(instance.width, instance.height) / steps;
      preFactor = (spacing * data.multiplier) / Math.PI;
      preFactor = preFactor * data.zoom;
      let stroke = data.stroke;
      rotate = instance.radians(data.rotate);
      instance.strokeWeight(Math.min(instance.sqrt(preFactor) / 4.5, 1));
      pan =
        -data.zoom * instance.min(instance.width, instance.height) * data.pan;

      instance.push();
      instance.background(0, 0, 0.2 * 255);
      instance.translate(instance.width / 2 + pan, instance.height / 2);
      instance.rotate(rotate);

      for (let tile of Object.values(data.tiles)) {
        let tileIsSelected = false;
        if (data.selectedTiles.length > 0) {
          tileIsSelected =
            data.selectedTiles.filter((e) => e.x == tile.x && e.y == tile.y)
              .length > 0;
        }

        let tileInSelectedLine = false;
        let numLinesPassingThroughTile = 0;

        if (data.selectedLines.length > 0) {
          for (let l of tile.lines) {
            if (
              data.selectedLines.filter(
                (e) => e.angle == l.angle && e.index == l.index
              ).length > 0
            ) {
              tileInSelectedLine = true;
              numLinesPassingThroughTile++;
            }
          }
        }

        if (data.colorTiles) {
          let color = data.colors.filter((e) =>
            data.orientationColoring
              ? e.angles == tile.angles
              : e.area == tile.area
          )[0];

          instance.fill(color.fill);
          if (data.showStroke) {
            instance.stroke(stroke, stroke, stroke);
          } else {
            instance.noStroke();
          }

          if (tileInSelectedLine) {
            instance.fill(0, 255, 0);
            if (numLinesPassingThroughTile > 1) {
              instance.fill(60, 179, 113);
            }
          }
          if (tileIsSelected) {
            instance.fill(128, 215, 255);
          }
        } else {
          instance.stroke(0, 255, 0);
          instance.noFill();

          if (tileInSelectedLine) {
            instance.fill(0, 255, 0, 150);
            if (numLinesPassingThroughTile > 1) {
              instance.fill(60, 179, 113, 150);
            }
          }
          if (tileIsSelected) {
            instance.fill(110, 110, 255);
          }
        }

        instance.beginShape();
        for (let pt of tile.dualPts) {
          instance.vertex(preFactor * pt.x, preFactor * pt.y);
        }
        instance.endShape(instance.CLOSE);
      }

      instance.pop();
    }

    function generateAndDownloadSVG(data) {
      const xmlns = "http://www.w3.org/2000/svg";
      const boxWidth = 1000;
      const boxHeight = 1000;
      let svg = document.createElementNS(xmlns, "svg");
      svg.setAttributeNS(null, "viewBox", `0 0 ${boxWidth} ${boxHeight}`);
      svg.setAttributeNS(null, "width", boxWidth);
      svg.setAttributeNS(null, "height", boxHeight);

      let steps = data.steps;
      let multiplier = data.multiplier;
      let spacing = Math.min(boxWidth, boxHeight) / steps;
      preFactor = (spacing * data.multiplier) / Math.PI;
      preFactor = preFactor * data.zoom;
      rotate = (data.rotate * Math.PI) / 180;
      pan = -data.zoom * Math.min(boxWidth, boxHeight) * data.pan;

      for (let tile of Object.values(data.tiles)) {
        let tilePath = document.createElementNS(xmlns, "path");
        let d = tile.dualPts
          .map((pt) => `${preFactor * pt.x},${preFactor * pt.y}`)
          .join(" ");
        tilePath.setAttributeNS(null, "d", `M${d} Z`);
        tilePath.setAttributeNS(
          null,
          "fill",
          data.colorTiles ? `#${tile.color}` : "none"
        );
        tilePath.setAttributeNS(
          null,
          "stroke",
          data.showStroke ? `#${data.stroke}` : "none"
        );
        tilePath.setAttributeNS(null, "data-rotation", tile.rotation || 0);
        tilePath.setAttributeNS(null, "data-offset-x", tile.offsetX || 0);
        tilePath.setAttributeNS(null, "data-offset-y", tile.offsetY || 0);
        svg.appendChild(tilePath);
      }

      let svgData = new XMLSerializer().serializeToString(svg);
      let svgBlob = new Blob([svgData], {
        type: "image/svg+xml;charset=utf-8",
      });
      let svgUrl = URL.createObjectURL(svgBlob);
      let downloadLink = document.createElement("a");
      downloadLink.href = svgUrl;
      downloadLink.download = "Tiling Pattern.svg";
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
    }

    function whichSide(xp, yp, x1, y1, x2, y2) {
      return Math.sign((yp - y1) * (x2 - x1) - (xp - x1) * (y2 - y1));
    }

    function tileToString(tile) {
      return JSON.stringify({
        x: tile.x,
        y: tile.y,
      });
    }
  };
}
