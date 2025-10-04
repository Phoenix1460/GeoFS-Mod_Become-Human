// GeoFS Human Transformation Script
// Adds ability to transform into a human character that can walk around

;(() => {
  // Declare geofs and Cesium variables
  let geofs
  let Cesium
  const keys = {} // Declare keys variable

  // Wait for GeoFS and Cesium to be loaded
  function waitForGeoFS() {
    if (typeof window.geofs === "undefined" || typeof window.Cesium === "undefined") {
      setTimeout(waitForGeoFS, 1000)
      return
    }
    geofs = window.geofs
    Cesium = window.Cesium
    initHumanTransform()
  }

  // Human character state
  let humanMode = false
  let humanEntity = null
  let originalAircraft = null
  let humanPosition = null
  let targetPosition = null
  let currentPosition = null
  const walkSpeed = 8.0 // meters per second
  let isWalking = false
  const walkDirection = { x: 0, y: 0 }
  let cameraFollowEnabled = true
  let mouseX = 0
  let mouseY = 0
  let cameraYaw = 0
  let cameraPitch = 0
  let targetYaw = 0
  let targetPitch = 0
  const cameraSmoothing = 0.15 // Higher = more responsive, lower = smoother

  function initHumanTransform() {
    console.log("Initializing GeoFS Human Transform...")

    // Create the transform button
    createTransformButton()

    // Set up keyboard controls
    setupKeyboardControls()

    // Set up update loop
    setupUpdateLoop()
  }

  function createTransformButton() {
    // Create button container
    const buttonContainer = document.createElement("div")
    buttonContainer.style.cssText = `
            position: fixed;
            top: 20px;
            left: 20px;
            z-index: 10000;
            background: rgba(0, 0, 0, 0.8);
            border-radius: 8px;
            padding: 10px;
            font-family: Arial, sans-serif;
        `

    // Create transform button
    const transformBtn = document.createElement("button")
    transformBtn.innerHTML = "🚶 Transform to Human"
    transformBtn.style.cssText = `
            background: #4CAF50;
            color: white;
            border: none;
            padding: 10px 15px;
            border-radius: 5px;
            cursor: pointer;
            font-size: 14px;
            margin-right: 10px;
        `

    transformBtn.addEventListener("click", toggleHumanMode)

    // Create info display
    const infoDiv = document.createElement("div")
    infoDiv.id = "human-info"
    infoDiv.style.cssText = `
            color: white;
            font-size: 12px;
            margin-top: 5px;
            display: none;
        `
    infoDiv.innerHTML = "WASD to walk, SHIFT to run, Click button again to respawn aircraft"

    buttonContainer.appendChild(transformBtn)
    buttonContainer.appendChild(infoDiv)
    document.body.appendChild(buttonContainer)

    // Store references
    window.humanTransformBtn = transformBtn
    window.humanInfoDiv = infoDiv
  }

  function toggleHumanMode() {
    if (!humanMode) {
      enterHumanMode()
    } else {
      exitHumanMode()
    }
  }

  function enterHumanMode() {
    console.log("[Mod] Entering human mode...")

    // Store current aircraft reference
    originalAircraft = geofs.aircraft.instance

    if (!originalAircraft) {
      alert("No aircraft found! Please spawn an aircraft first.")
      return
    }

    // Get current aircraft position
    const aircraftPos = originalAircraft.llaLocation
    humanPosition = Cesium.Cartesian3.fromDegrees(
      aircraftPos[1], // longitude
      aircraftPos[0], // latitude
      aircraftPos[2] + 2, // altitude + 2 meters above ground
    )

    if (geofs.aircraft.instance) {
      geofs.aircraft.instance.object3d.visible = false
      geofs.aircraft.instance = null
    }

    // Create human character entity
    createHumanCharacter()

    switchToHumanCamera()

    // Update UI
    humanMode = true
    window.humanTransformBtn.innerHTML = "✈️ Respawn Aircraft"
    window.humanTransformBtn.style.background = "#FF6B6B"
    window.humanInfoDiv.style.display = "block"

    console.log("[Mod] Human mode activated, aircraft deleted")
  }

  function exitHumanMode() {
    console.log("[Mod] Exiting human mode...")

    if (document.pointerLockElement) {
      document.exitPointerLock()
    }

    if (humanEntity && humanEntity.entities) {
      const viewer = geofs.api.viewer
      humanEntity.entities.forEach((entity) => {
        try {
          viewer.entities.remove(entity)
        } catch (e) {
          console.log("[Mod] Error removing entity:", e)
        }
      })
    }

    if (humanPosition) {
      const cartographic = Cesium.Cartographic.fromCartesian(humanPosition)
      const lat = Cesium.Math.toDegrees(cartographic.latitude)
      const lon = Cesium.Math.toDegrees(cartographic.longitude)
      const alt = cartographic.height + 100 // Spawn 100m above human

      setTimeout(() => {
        geofs.aircraft.spawn({
          location: [lat, lon, alt],
          heading: 0,
        })
      }, 100)
    }

    // Reset state
    humanMode = false
    humanEntity = null
    humanPosition = null
    cameraFollowEnabled = false
    cameraYaw = 0
    cameraPitch = 0
    mouseX = 0
    mouseY = 0
    targetYaw = 0
    targetPitch = 0

    // Update UI
    window.humanTransformBtn.innerHTML = "🚶 Transform to Human"
    window.humanTransformBtn.style.background = "#4CAF50"
    window.humanInfoDiv.style.display = "none"

    console.log("[Mod] Aircraft respawned, human mode deactivated")
  }

  function createHumanCharacter() {
    console.log("[Mod] Creating human character at position:", humanPosition)
    const viewer = geofs.api.viewer

    const bodyEntity = viewer.entities.add({
      position: humanPosition,
      cylinder: {
        length: 3.0, // Much taller
        topRadius: 0.6,
        bottomRadius: 0.8,
        material: Cesium.Color.BLUE.withAlpha(1.0), // Fully opaque
        outline: true,
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 3,
      },
    })

    const headOffset = new Cesium.Cartesian3(0, 0, 2.5)
    const headPosition = Cesium.Cartesian3.add(humanPosition, headOffset, new Cesium.Cartesian3())

    const headEntity = viewer.entities.add({
      position: headPosition,
      ellipsoid: {
        radii: new Cesium.Cartesian3(0.4, 0.4, 0.5), // Much larger
        material: Cesium.Color.PEACHPUFF,
        outline: true,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
      },
    })

    const leftArmOffset = new Cesium.Cartesian3(-1.0, 0, 1.0)
    const rightArmOffset = new Cesium.Cartesian3(1.0, 0, 1.0)

    const leftArmEntity = viewer.entities.add({
      position: Cesium.Cartesian3.add(humanPosition, leftArmOffset, new Cesium.Cartesian3()),
      cylinder: {
        length: 2.0, // Longer arms
        topRadius: 0.2,
        bottomRadius: 0.2,
        material: Cesium.Color.PEACHPUFF.withAlpha(1.0),
        outline: true,
        outlineColor: Cesium.Color.BLACK,
      },
    })

    const rightArmEntity = viewer.entities.add({
      position: Cesium.Cartesian3.add(humanPosition, rightArmOffset, new Cesium.Cartesian3()),
      cylinder: {
        length: 2.0,
        topRadius: 0.2,
        bottomRadius: 0.2,
        material: Cesium.Color.PEACHPUFF.withAlpha(1.0),
        outline: true,
        outlineColor: Cesium.Color.BLACK,
      },
    })

    const leftLegOffset = new Cesium.Cartesian3(-0.3, 0, -2.0)
    const rightLegOffset = new Cesium.Cartesian3(0.3, 0, -2.0)

    const leftLegEntity = viewer.entities.add({
      position: Cesium.Cartesian3.add(humanPosition, leftLegOffset, new Cesium.Cartesian3()),
      cylinder: {
        length: 2.5, // Longer legs
        topRadius: 0.25,
        bottomRadius: 0.25,
        material: Cesium.Color.DARKBLUE.withAlpha(1.0),
        outline: true,
        outlineColor: Cesium.Color.WHITE,
      },
    })

    const rightLegEntity = viewer.entities.add({
      position: Cesium.Cartesian3.add(humanPosition, rightLegOffset, new Cesium.Cartesian3()),
      cylinder: {
        length: 2.5,
        topRadius: 0.25,
        bottomRadius: 0.25,
        material: Cesium.Color.DARKBLUE.withAlpha(1.0),
        outline: true,
        outlineColor: Cesium.Color.WHITE,
      },
    })

    const labelEntity = viewer.entities.add({
      position: humanPosition,
      label: {
        text: "YOU (HUMAN)",
        font: "24pt Arial bold",
        fillColor: Cesium.Color.YELLOW,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 3,
        pixelOffset: new Cesium.Cartesian2(0, -120),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        scale: 1.5,
      },
    })

    // Store all entities as a group
    humanEntity = {
      body: bodyEntity,
      head: headEntity,
      leftArm: leftArmEntity,
      rightArm: rightArmEntity,
      leftLeg: leftLegEntity,
      rightLeg: rightLegEntity,
      label: labelEntity,
      entities: [bodyEntity, headEntity, leftArmEntity, rightArmEntity, leftLegEntity, rightLegEntity, labelEntity],
    }

    currentPosition = Cesium.Cartesian3.clone(humanPosition)
    targetPosition = Cesium.Cartesian3.clone(humanPosition)

    console.log("[Mod] Human character created successfully")
  }

  function switchToHumanCamera() {
    console.log("[Mod] Switching camera to human")
    cameraFollowEnabled = true

    const viewer = geofs.api.viewer
    const camera = viewer.camera

    const cameraDistance = 8 // Much closer - human scale
    const cameraHeight = 3 // Human eye level height

    const cartographic = Cesium.Cartographic.fromCartesian(humanPosition)
    const surfaceNormal = Cesium.Cartesian3.normalize(humanPosition, new Cesium.Cartesian3())

    const eastDirection = Cesium.Cartesian3.cross(Cesium.Cartesian3.UNIT_Z, surfaceNormal, new Cesium.Cartesian3())
    Cesium.Cartesian3.normalize(eastDirection, eastDirection)
    const northDirection = Cesium.Cartesian3.cross(surfaceNormal, eastDirection, new Cesium.Cartesian3())
    Cesium.Cartesian3.normalize(northDirection, northDirection)

    // Position camera behind human
    const backwardDirection = Cesium.Cartesian3.multiplyByScalar(
      northDirection,
      -cameraDistance,
      new Cesium.Cartesian3(),
    )
    const upwardDirection = Cesium.Cartesian3.multiplyByScalar(surfaceNormal, cameraHeight, new Cesium.Cartesian3())

    const cameraPosition = Cesium.Cartesian3.add(humanPosition, backwardDirection, new Cesium.Cartesian3())
    Cesium.Cartesian3.add(cameraPosition, upwardDirection, cameraPosition)

    camera.setView({
      destination: cameraPosition,
      orientation: {
        direction: northDirection, // Look forward, not down at human
        up: surfaceNormal,
      },
    })

    console.log("[Mod] Camera positioned at human")
  }

  function setupKeyboardControls() {
    document.addEventListener("keydown", (event) => {
      if (!humanMode) return

      const key = event.key.toUpperCase()
      keys[key] = true // Declare keys variable before using it
    })

    document.addEventListener("keyup", (event) => {
      if (!humanMode) return

      const key = event.key.toUpperCase()
      keys[key] = false // Declare keys variable before using it
    })

    document.addEventListener("mousemove", (event) => {
      if (!humanMode || document.pointerLockElement !== document.body) return

      const sensitivity = 0.003 // Increased from 0.002

      targetYaw += event.movementX * sensitivity
      targetPitch -= event.movementY * sensitivity

      // Clamp pitch to prevent flipping
      targetPitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, targetPitch))
    })

    document.addEventListener("click", () => {
      if (humanMode && document.pointerLockElement !== document.body) {
        document.body.requestPointerLock()
      }
    })

    document.addEventListener("pointerlockchange", () => {
      if (humanMode && document.pointerLockElement === document.body) {
        console.log("[Mod] Mouse locked - Smooth controls active")
      }
    })
  }

  function setupUpdateLoop() {
    function update() {
      if (humanMode && humanEntity) {
        updateHumanMovement()
        updateCamera()
      }
      requestAnimationFrame(update)
    }
    update()
  }

  function updateHumanMovement() {
    // Calculate movement direction
    walkDirection.x = 0
    walkDirection.y = 0

    if (keys.W) walkDirection.y += 1
    if (keys.S) walkDirection.y -= 1
    if (keys.A) walkDirection.x -= 1
    if (keys.D) walkDirection.x += 1

    // Normalize direction
    const length = Math.sqrt(walkDirection.x * walkDirection.x + walkDirection.y * walkDirection.y)
    if (length > 0) {
      walkDirection.x /= length
      walkDirection.y /= length
      isWalking = true
    } else {
      isWalking = false
    }

    if (isWalking) {
      const currentSpeed = keys.SHIFT ? walkSpeed * 6 : walkSpeed * 3

      // Get current position in cartographic coordinates
      const cartographic = Cesium.Cartographic.fromCartesian(currentPosition)

      // Calculate movement in meters
      const deltaTime = 1 / 60 // Assuming 60 FPS
      const moveDistance = currentSpeed * deltaTime

      // Calculate forward direction from camera yaw and pitch (same as camera)
      const forwardDir = new Cesium.Cartesian3(
        Math.cos(cameraPitch) * Math.sin(cameraYaw),
        Math.cos(cameraPitch) * Math.cos(cameraYaw),
        0, // Don't move up/down when walking
      )

      // Calculate right direction (perpendicular to forward)
      const rightDir = new Cesium.Cartesian3(Math.cos(cameraYaw), -Math.sin(cameraYaw), 0)

      // Apply movement based on WASD and camera direction
      const moveX = (forwardDir.x * walkDirection.y + rightDir.x * walkDirection.x) * moveDistance
      const moveY = (forwardDir.y * walkDirection.y + rightDir.y * walkDirection.x) * moveDistance

      // Convert movement to lat/lon changes
      const earthRadius = 6371000 // Earth radius in meters
      const deltaLat = (moveY / earthRadius) * (180 / Math.PI)
      const deltaLon = (moveX / (earthRadius * Math.cos(cartographic.latitude))) * (180 / Math.PI)

      const newLat = Cesium.Math.toDegrees(cartographic.latitude) + deltaLat
      const newLon = Cesium.Math.toDegrees(cartographic.longitude) + deltaLon
      const newAlt = cartographic.height

      targetPosition = Cesium.Cartesian3.fromDegrees(newLon, newLat, newAlt)
    }

    if (targetPosition && currentPosition) {
      const lerpFactor = isWalking ? 0.9 : 0.1
      currentPosition = Cesium.Cartesian3.lerp(currentPosition, targetPosition, lerpFactor, currentPosition)

      // Update human position
      humanPosition = Cesium.Cartesian3.clone(currentPosition)

      updateHumanBodyParts()
    }
  }

  function updateHumanBodyParts() {
    if (!humanEntity || !humanPosition) return

    // Update body position
    humanEntity.body.position = humanPosition

    // Update head position
    const headOffset = new Cesium.Cartesian3(0, 0, 2.5)
    const headPosition = Cesium.Cartesian3.add(humanPosition, headOffset, new Cesium.Cartesian3())
    humanEntity.head.position = headPosition

    // Update arms
    const leftArmOffset = new Cesium.Cartesian3(-1.0, 0, 1.0)
    const rightArmOffset = new Cesium.Cartesian3(1.0, 0, 1.0)
    humanEntity.leftArm.position = Cesium.Cartesian3.add(humanPosition, leftArmOffset, new Cesium.Cartesian3())
    humanEntity.rightArm.position = Cesium.Cartesian3.add(humanPosition, rightArmOffset, new Cesium.Cartesian3())

    // Update legs with slight walking animation
    const walkCycle = isWalking ? Math.sin(Date.now() * 0.01) * 0.1 : 0
    const leftLegOffset = new Cesium.Cartesian3(-0.3, walkCycle, -2.0)
    const rightLegOffset = new Cesium.Cartesian3(0.3, -walkCycle, -2.0)
    humanEntity.leftLeg.position = Cesium.Cartesian3.add(humanPosition, leftLegOffset, new Cesium.Cartesian3())
    humanEntity.rightLeg.position = Cesium.Cartesian3.add(humanPosition, rightLegOffset, new Cesium.Cartesian3())

    // Update label
    humanEntity.label.position = humanPosition
  }

  function updateCamera() {
    if (!humanMode || !humanPosition || !cameraFollowEnabled) return

    cameraYaw = Cesium.Math.lerp(cameraYaw, targetYaw, cameraSmoothing)
    cameraPitch = Cesium.Math.lerp(cameraPitch, targetPitch, cameraSmoothing)

    const viewer = geofs.api.viewer
    const camera = viewer.camera

    const eyeHeight = 1.7
    const cartographic = Cesium.Cartographic.fromCartesian(humanPosition)

    // Use the same ground height as the human character, not ellipsoid height
    const cameraPosition = Cesium.Cartesian3.fromDegrees(
      Cesium.Math.toDegrees(cartographic.longitude),
      Cesium.Math.toDegrees(cartographic.latitude),
      cartographic.height + eyeHeight,
    )

    // Create transformation matrix from local to world coordinates
    const transform = Cesium.Transforms.eastNorthUpToFixedFrame(cameraPosition)

    // Create local direction vector (in ENU coordinates)
    const localDirection = new Cesium.Cartesian3(
      Math.sin(cameraYaw) * Math.cos(cameraPitch), // East
      Math.cos(cameraYaw) * Math.cos(cameraPitch), // North
      Math.sin(cameraPitch), // Up
    )

    // Transform local direction to world coordinates
    const worldDirection = Cesium.Matrix4.multiplyByPointAsVector(transform, localDirection, new Cesium.Cartesian3())
    Cesium.Cartesian3.normalize(worldDirection, worldDirection)

    // Create local up vector and transform to world coordinates
    const localUp = new Cesium.Cartesian3(0, 0, 1)
    const worldUp = Cesium.Matrix4.multiplyByPointAsVector(transform, localUp, new Cesium.Cartesian3())
    Cesium.Cartesian3.normalize(worldUp, worldUp)

    // Set camera view with proper world coordinates
    camera.setView({
      destination: cameraPosition,
      orientation: {
        direction: worldDirection,
        up: worldUp,
      },
    })
  }

  // Initialize when page loads
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", waitForGeoFS)
  } else {
    waitForGeoFS()
  }

  console.log("GeoFS Human Transform script loaded!")
})()
