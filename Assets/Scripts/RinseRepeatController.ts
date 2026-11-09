import {Interactable} from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable"
import {InteractableManipulation} from "SpectaclesInteractionKit.lspkg/Components/Interaction/InteractableManipulation/InteractableManipulation"
import WorldCameraFinderProvider from "SpectaclesInteractionKit.lspkg/Providers/CameraProvider/WorldCameraFinderProvider"
import {Button} from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button"

/**
 * Rinse & Repeat: a simulated practice bathroom that teaches the shower order
 * (shampoo, conditioner, then body wash or bar soap).
 *
 * Flow: take the towel from the bed, open the bathroom door -> bright light -> walk in and
 * hang the towel on the bar -> step into the tub -> lesson -> finish. A floating guide panel
 * in front of the user says what to do next and gives feedback.
 * Scene objects are found by name under this object and the camera, so they can be
 * moved freely in the editor. Grab, pinch and hover behaviour is added at runtime with
 * Spectacles Interaction Kit, so it works with hands, the mouse in Interactive Preview
 * and LEAF.
 */

type Stage = "opening" | "doorOpening" | "towelToBar" | "intro" | "toTub" | "lesson" | "finished"
type ProductId = "Shampoo" | "Conditioner" | "BodyWash" | "BarSoap"
/** rest: folded on the bed. held: hanging from the pinch. carried: hanging at the user's side. */
type TowelState = "rest" | "held" | "carried" | "flying" | "onBar"

interface Product {
  id: ProductId
  obj: SceneObject
  step: number // 0 shampoo, 1 conditioner, 2 body
  homePos: vec3 // local to the product's parent, so the rooms can be moved as a whole
  homeRot: quat
  interactable: Interactable
  manip: InteractableManipulation
  collider: ColliderComponent
  used: boolean
  returning: boolean
  childHome: vec3[] // visuals' local positions, restored after the glide to the head
  gliding: boolean
  releasedEarly: boolean
}

interface Tween {
  duration: number
  elapsed: number
  update: (t: number) => void
  done?: () => void
}

interface Timer {
  at: number
  fn: () => void
}

/** A glowing hint (bobbing arrow and/or pulsing ring) shown while `show` is true. */
interface Marker {
  root: SceneObject
  arrow?: Transform
  arrowBase?: vec3
  ring?: Transform
  ringBase?: vec3
  show: () => boolean
}

const LESSON = [
  {
    title: "1. Shampoo first",
    tip: "Massage it into your scalp with your fingertips, not your nails. Then rinse.",
    more:
      "Shampoo cleans your scalp and hair, so it goes first. Use about a coin-sized amount, " +
      "work it into the scalp with your fingertips, and rinse it out fully.",
  },
  {
    title: "2. Conditioner second",
    tip: "Put it on the lengths and ends of your hair. Leave it for a minute or two, then rinse.",
    more:
      "Conditioner softens and smooths hair after shampoo. Focus on the middle and ends rather " +
      "than the scalp, leave it on briefly, then rinse.",
  },
  {
    title: "3. Body wash or bar soap last",
    tip: "Wash your whole body from top to bottom. Be gentle on sensitive areas.",
    more:
      "Washing your body last rinses away the film shampoo and conditioner can leave on your " +
      "back and chest, which can clog pores. Body wash and bar soap do the same job, so pick " +
      "whichever you prefer.",
  },
]

export const MSG_CORRECT = "Correct! Now use it on yourself."
export const MSG_INCORRECT = "Not yet. Put it back."
export const MSG_BODY_CHOICE = "Body wash: quick and easy. Bar soap: the classic. Either one works."
export const MSG_LEARN = "Time to learn how to take a shower."
export const MSG_FINISH = "That's the routine: shampoo, conditioner, then body wash or soap."
export const MSG_OPEN_DOOR = "Now open the door: pinch the handle."
export const MSG_HANG_TOWEL = "Hang your towel on the towel bar."
export const MSG_STEP_IN = "Step into the bathtub."
export const MSG_FIRST = "What do you use first? Pick it up."
export const MSG_NEXT = "What comes next? Pick it up."
export const MSG_LIFT = "Correct! Lift it into the glowing ring to use it on your head."

const COLOR_CORRECT = new vec4(0.55, 1.0, 0.62, 1)
const COLOR_INCORRECT = new vec4(1.0, 0.62, 0.5, 1)
const COLOR_GUIDE = new vec4(1, 0.98, 0.9, 1)
/** The bathtub's floor in Rooms-local cm (x, z); stepping in starts the lesson. */
const TUB = {x0: 52.5, x1: 127.5, z0: -557.5, z1: -387.5}

@component
export class RinseRepeatController extends BaseScriptComponent {
  @input
  @hint("Splash played when a product is used in the face zone")
  splashTrack: AudioTrackAsset

  @input
  @hint("Face zone radius in cm (sphere around the FaceZone object, 25 cm in front of the face)")
  faceZoneRadius: number = 20

  @input
  @hint("Also count a product as used when it is lifted to about eye level in front of you (mouse drags keep a fixed distance from the camera)")
  eyeLevelAssist: boolean = true

  @input
  @hint("How close (cm) the towel must be to the bar when released")
  towelSnapDistance: number = 30

  @input
  @hint("Where the Lens starts in preview: opening (default), towel, or lesson")
  startAt: string = "opening"

  @input
  @hint("How close (cm) the user may get to a wall before the view fades and asks them to step back inside")
  wallMargin: number = 15

  @input
  tipSeconds: number = 5

  @input
  introSeconds: number = 3

  // ---- public state, read by the LEAF scenarios ----
  public stage: Stage = "opening"
  public step: number = 0
  public towelTaken: boolean = false
  public towelOnBar: boolean = false
  public learnMoreOpen: boolean = false
  public lastUsedStep: number = -1
  public splashPlays: number = 0
  public towelState: TowelState = "rest"
  public outOfBounds: boolean = false

  private camTransform: Transform
  private tweens: Tween[] = []
  private timers: Timer[] = []
  private products: Product[] = []
  private held: Product | null = null
  private audio: AudioComponent

  // scene references
  private opening: SceneObject
  private bathroom: SceneObject
  private doorHinge: SceneObject
  private doorHandle: SceneObject
  private towel: SceneObject
  private towelSign: SceneObject
  private towelBar: SceneObject
  private towelInteractable: Interactable
  private towelManip: InteractableManipulation
  private towelCollider: ColliderComponent
  private towelHomePos: vec3
  private towelHomeRot: quat
  private brightLight: SceneObject
  private brightMat: Material
  private faceZone: SceneObject
  private putTowelText: SceneObject
  private lessonText: SceneObject
  private finishText: SceneObject
  private tipCard: SceneObject
  private tipText: Text
  private tipBgMat: Material
  private learnMoreButton: SceneObject
  private learnMorePanel: SceneObject
  private learnMoreTitle: Text
  private learnMoreBody: Text
  private badge: SceneObject
  private badgeText: Text
  private badgeHint: Text
  private towelBarSpot: SceneObject
  private towelFolded: SceneObject
  private towelHanging: SceneObject
  private towelDraped: SceneObject
  private lessonSpot: SceneObject
  private bathEntrySpot: SceneObject
  private towelLastPos: vec3 | null = null
  private swing = {x: 0, z: 0, vx: 0, vz: 0}
  private doorHingeHomeRot: quat
  private markers: Marker[] = []
  private doorHandleHomeRot: quat
  private guidePanel: SceneObject
  private guideText: Text
  private guideMessage = ""
  private guideFlash = ""
  private guideFlashColor = COLOR_INCORRECT
  private guideFlashUntil = 0
  private following = new Set<SceneObject>()
  private useTarget: SceneObject
  private useTargetPos: vec3 = vec3.zero()
  private boundaryWarning: SceneObject
  private boundaryText: Text
  private boundaryFade = 0
  private tipToken = 0
  private lessonToken = 0

  onAwake() {
    this.opening = this.find("Opening")
    this.bathroom = this.find("Bathroom")
    this.doorHinge = this.find("DoorHinge")
    this.doorHandle = this.find("DoorHandle")
    this.towel = this.find("Towel")
    this.towelSign = this.find("TowelSign")
    this.towelBar = this.find("TowelBar")
    this.towelBarSpot = this.find("TowelBarSpot")
    this.towelFolded = this.find("TowelFolded")
    this.towelHanging = this.find("TowelHanging")
    this.towelDraped = this.find("TowelDraped")
    this.lessonSpot = this.find("LessonSpot")
    this.bathEntrySpot = this.find("BathEntrySpot")
    this.brightLight = this.find("BrightLight")
    this.faceZone = this.find("FaceZone")
    this.putTowelText = this.find("PutTowelText")
    this.guidePanel = this.find("GuidePanel")
    this.guideText = this.guidePanel.getComponent("Component.Text") as Text
    this.guidePanel.enabled = false
    this.useTarget = this.find("UseTarget")
    this.useTarget.enabled = false
    // Glowing hints: the towel on the bed, the door handle once you have the towel, the bar
    // while you carry the towel in the bathroom.
    this.addMarker("TowelMarker", "TowelMarkerArrow", "TowelMarkerRing", () => this.stage === "opening" && !this.towelTaken)
    this.addMarker("HandleMarker", null, "HandleMarkerRing", () => this.stage === "opening" && this.towelTaken)
    this.addMarker(
      "BarMarker",
      "BarMarkerArrow",
      null,
      () => this.stage === "towelToBar" && (this.towelState === "carried" || this.towelState === "held"),
    )
    this.boundaryWarning = this.find("BoundaryWarning")
    this.boundaryText = this.boundaryWarning.getComponent("Component.Text") as Text
    this.boundaryWarning.enabled = false
    this.lessonText = this.find("LessonText")
    this.finishText = this.find("FinishText")
    this.tipCard = this.find("TipCard")
    this.tipText = this.textOf("TipText")
    this.learnMoreButton = this.find("LearnMoreButton")
    this.learnMorePanel = this.find("LearnMorePanel")
    this.learnMoreTitle = this.textOf("LearnMoreTitle")
    this.learnMoreBody = this.textOf("LearnMoreBody")
    this.badge = this.find("Badge")
    this.badgeText = this.textOf("BadgeText")
    this.badgeHint = this.textOf("BadgeHint")

    this.brightMat = this.cloneMaterial(this.find("BrightLight"))
    this.tipBgMat = this.cloneMaterial(this.find("TipCardBg"))

    // The face zone is a stand-in: visible in the editor, invisible while the Lens runs.
    const zoneVisual = this.faceZone.getComponent("Component.RenderMeshVisual")
    if (zoneVisual) zoneVisual.enabled = false

    this.audio = this.sceneObject.createComponent("Component.AudioComponent") as AudioComponent
    if (this.splashTrack) this.audio.audioTrack = this.splashTrack

    this.doorHingeHomeRot = this.doorHinge.getTransform().getLocalRotation()
    this.doorHandleHomeRot = this.doorHandle.getTransform().getLocalRotation()

    // Towel: grab it from the bed; it hangs from the pinch and is carried at your side.
    this.towelHomePos = this.towel.getTransform().getLocalPosition()
    this.towelHomeRot = this.towel.getTransform().getLocalRotation()
    const towelParts = this.makeGrabbable(this.towel, new vec3(40, 16, 28))
    this.towelInteractable = towelParts.interactable
    this.towelManip = towelParts.manip
    this.towelCollider = towelParts.collider

    // Door handle: pinch.
    const handleInteractable = this.makePinchable(this.doorHandle, new vec3(18, 12, 10))
    // Towel bar: pinch it to hang the towel you are carrying.
    const barInteractable = this.makePinchable(this.towelBar, new vec3(70, 14, 20))

    // Products.
    const ids: ProductId[] = ["Shampoo", "Conditioner", "BodyWash", "BarSoap"]
    const steps = [0, 1, 2, 2]
    ids.forEach((id, i) => {
      const obj = this.find(id)
      const size = id === "BarSoap" ? new vec3(10, 8, 9) : new vec3(10, 24, 8)
      const parts = this.makeGrabbable(obj, size)
      this.products.push({
        id,
        obj,
        step: steps[i],
        homePos: obj.getTransform().getLocalPosition(),
        homeRot: obj.getTransform().getLocalRotation(),
        interactable: parts.interactable,
        manip: parts.manip,
        collider: parts.collider,
        used: false,
        returning: false,
        childHome: this.childPositions(obj),
        gliding: false,
        releasedEarly: false,
      })
    })

    // Learn more button (UI Kit).
    const button = this.learnMoreButton.createComponent(Button.getTypeName()) as Button
    button.size = new vec3(11, 5, 1)

    this.createEvent("OnStartEvent").bind(() => {
      this.camTransform = WorldCameraFinderProvider.getInstance().getTransform()

      this.towelManip.onManipulationStart.add(() => this.onTowelGrab())
      this.towelManip.onManipulationEnd.add(() => this.onTowelRelease())
      handleInteractable.onTriggerStart.add(() => this.onDoorHandle())
      barInteractable.onTriggerStart.add(() => this.onTowelBarPinch())

      this.products.forEach((p) => {
        p.manip.onManipulationStart.add(() => this.onProductGrab(p))
        p.manip.onManipulationEnd.add(() => this.onProductRelease(p))
      })

      button.onTriggerUp.add(() => this.toggleLearnMore())

      if (this.startAt === "lesson") this.jumpToLesson()
      else if (this.startAt === "towel") this.jumpToTowelToBar()
      else this.resetToOpening()
    })

    this.createEvent("UpdateEvent").bind(() => this.onUpdate())
  }

  // ------------------------------------------------------------------ flow

  /** Full reset to the opening scene (door, towel and sign). */
  public resetToOpening() {
    this.clearPending()
    this.stage = "opening"
    this.step = 0
    this.towelTaken = false
    this.towelOnBar = false
    this.lastUsedStep = -1
    this.held = null
    this.sceneObject.getTransform().setWorldPosition(vec3.zero())

    this.opening.enabled = true
    this.bathroom.enabled = true
    this.brightLight.enabled = false
    this.towelSign.enabled = true
    this.doorHinge.getTransform().setLocalRotation(this.doorHingeHomeRot)
    this.doorHandle.getTransform().setLocalRotation(this.doorHandleHomeRot)
    this.guideMessage = ""
    this.guideFlashUntil = 0
    this.useTarget.enabled = false

    this.towel.enabled = true
    this.towel.getTransform().setLocalPosition(this.towelHomePos)
    this.towel.getTransform().setLocalRotation(this.towelHomeRot)
    this.setTowelState("rest")
    this.setInteractive(this.towelInteractable, this.towelManip, true)

    this.resetLessonUi()
    this.resetProducts()
    this.setProductsInteractive(false)
  }

  /** Test helper: skip to inside the bathroom door, carrying the towel. */
  public jumpToTowelToBar() {
    this.resetToOpening()
    this.towelTaken = true
    this.towelSign.enabled = false
    this.openDoorInstantly()
    this.enterBathroom()
    this.setTowelState("carried")
    this.placeUserAt(this.bathEntrySpot)
    this.snapTowelToSide()
  }

  /** Test helper: skip straight to the start of the lesson, standing in the tub. */
  public jumpToLesson() {
    this.resetToOpening()
    this.towelTaken = true
    this.towelSign.enabled = false
    this.openDoorInstantly()
    this.enterBathroom()
    this.hangTowelOnBar()
    this.putTowelText.enabled = false
    this.startLesson()
    this.placeUserAt(this.lessonSpot)
  }

  /**
   * Move the rooms so that `spot` is under the user (height unchanged). Only used to skip
   * ahead in the preview and in tests; in normal use the user walks there.
   */
  private placeUserAt(spot: SceneObject) {
    if (!this.camTransform) return
    const root = this.sceneObject.getTransform()
    root.setWorldPosition(vec3.zero())
    const cam = this.camTransform.getWorldPosition()
    const p = spot.getTransform().getWorldPosition()
    root.setWorldPosition(new vec3(cam.x - p.x, 0, cam.z - p.z))
  }

  private openDoorInstantly() {
    const hinge = this.doorHinge.getTransform()
    hinge.setLocalRotation(this.doorHingeHomeRot.multiply(quat.angleAxis(MathUtils.DegToRad * 95, vec3.up())))
  }

  // ------------------------------------------------------------------ towel

  private setTowelState(state: TowelState) {
    this.towelState = state
    // Folded on the bed it is a wide target; once picked up, only the gathered top is grabbable.
    const shape = Shape.createBoxShape()
    shape.size = state === "rest" ? new vec3(40, 16, 28) : new vec3(16, 20, 8)
    this.towelCollider.shape = shape
    this.towelFolded.enabled = state === "rest"
    this.towelHanging.enabled = state === "held" || state === "carried" || state === "flying"
    this.towelDraped.enabled = state === "onBar"
    this.swing = {x: 0, z: 0, vx: 0, vz: 0}
    this.towelHanging.getTransform().setLocalRotation(quat.quatIdentity())
    this.towelLastPos = null
  }

  private onTowelGrab() {
    if (this.towelState === "onBar" || this.towelState === "flying") return
    if (this.stage === "opening" && !this.towelTaken) {
      this.towelTaken = true
      this.towelSign.enabled = false
      this.setGuide(MSG_OPEN_DOOR)
    }
    const wasResting = this.towelState === "rest"
    this.setTowelState("held")
    if (wasResting) this.faceCamera(this.towel.getTransform())
  }

  private onTowelRelease() {
    if (this.towelState !== "held") return
    const d = this.towel.getTransform().getWorldPosition().distance(this.towelBarSpot.getTransform().getWorldPosition())
    if (this.stage === "towelToBar" && d <= this.towelSnapDistance) {
      this.flyTowelToBar()
      return
    }
    // Let go anywhere else: the towel stays with you, hanging at your side.
    this.setTowelState("carried")
  }

  private onTowelBarPinch() {
    if (this.stage !== "towelToBar" || !this.towelTaken) return
    if (this.towelState === "onBar" || this.towelState === "flying") return
    this.flyTowelToBar()
  }

  private flyTowelToBar() {
    this.setTowelState("flying")
    this.setInteractive(this.towelInteractable, this.towelManip, false)
    const t = this.towel.getTransform()
    const spot = this.towelBarSpot.getTransform()
    const fromPos = t.getWorldPosition()
    const fromRot = t.getWorldRotation()
    this.tween(
      0.7,
      (k) => {
        const e = k * k * (3 - 2 * k)
        // A small arc so it reads as being tossed over the bar.
        const lift = new vec3(0, 12 * Math.sin(Math.PI * k), 0)
        t.setWorldPosition(vec3.lerp(fromPos, spot.getWorldPosition(), e).add(lift))
        t.setWorldRotation(quat.slerp(fromRot, spot.getWorldRotation(), e))
      },
      () => {
        this.hangTowelOnBar()
        this.onTowelHung()
      },
    )
  }

  private onTowelHung() {
    this.putTowelText.enabled = false
    this.stage = "intro"
    this.setGuide("")
    this.showText(this.lessonText, MSG_LEARN)
    this.placeInFront(this.lessonText)
    const token = ++this.lessonToken
    this.after(this.introSeconds, () => {
      if (token !== this.lessonToken) return
      this.fadeTextOut(this.lessonText, 0.6, () => {
        if (token !== this.lessonToken) return
        this.stage = "toTub"
        this.setGuide(MSG_STEP_IN)
      })
    })
  }

  private hangTowelOnBar() {
    this.towelOnBar = true
    const spot = this.towelBarSpot.getTransform()
    this.towel.getTransform().setWorldPosition(spot.getWorldPosition())
    this.towel.getTransform().setWorldRotation(spot.getWorldRotation())
    this.setTowelState("onBar")
    this.setInteractive(this.towelInteractable, this.towelManip, false)
  }

  /** Where the carried towel hangs: low on the left, just inside the view. */
  private towelSideTarget(): vec3 {
    const c = this.camTransform
    // Low and to the left, like a towel in your left hand, so it stays out of the line of sight to
    // the door handle and the towel bar (its collider would otherwise catch those clicks).
    return c.getWorldPosition().add(c.back.uniformScale(45)).add(c.right.uniformScale(-30)).add(c.up.uniformScale(-24))
  }

  private snapTowelToSide() {
    if (!this.camTransform) return
    const t = this.towel.getTransform()
    t.setWorldPosition(this.towelSideTarget())
    this.faceCamera(t)
  }

  private faceCamera(t: Transform) {
    if (!this.camTransform) return
    const toCam = this.camTransform.getWorldPosition().sub(t.getWorldPosition())
    toCam.y = 0
    if (toCam.length > 0.001) t.setWorldRotation(quat.lookAt(toCam.normalize(), vec3.up()))
  }

  /** Per frame: follow the user when carried, and swing the hanging cloth with the motion. */
  private updateTowel(dt: number) {
    if (this.towelState !== "held" && this.towelState !== "carried") return
    const t = this.towel.getTransform()
    if (this.towelState === "carried" && this.camTransform) {
      const k = 1 - Math.exp(-dt * 6)
      t.setWorldPosition(vec3.lerp(t.getWorldPosition(), this.towelSideTarget(), k))
      const toCam = this.camTransform.getWorldPosition().sub(t.getWorldPosition())
      toCam.y = 0
      if (toCam.length > 0.001) {
        t.setWorldRotation(quat.slerp(t.getWorldRotation(), quat.lookAt(toCam.normalize(), vec3.up()), k))
      }
    }
    const pos = t.getWorldPosition()
    const last = this.towelLastPos
    this.towelLastPos = pos
    if (!last || dt <= 0) return
    // Velocity in the towel's own frame; the bottom of the cloth trails behind the motion.
    const vel = t.getWorldRotation().invert().multiplyVec3(pos.sub(last).uniformScale(1 / dt))
    const clamp = (v: number) => Math.max(-0.6, Math.min(0.6, v))
    const targetX = clamp(vel.z * 0.004)
    const targetZ = clamp(-vel.x * 0.004)
    const s = this.swing
    const stiff = 45
    const damp = 5
    s.vx += (stiff * (targetX - s.x) - damp * s.vx) * dt
    s.vz += (stiff * (targetZ - s.z) - damp * s.vz) * dt
    s.x += s.vx * dt
    s.z += s.vz * dt
    this.towelHanging.getTransform().setLocalRotation(quat.fromEulerAngles(s.x, 0, s.z))
  }

  private onDoorHandle() {
    if (this.stage !== "opening") return
    if (!this.towelTaken) {
      // Locked for now: the lever gives a little and springs back, and the reminder pulses.
      this.tween(0.4, (k) => this.setHandleAngle(18 * Math.sin(k * Math.PI)))
      const t = this.towelSign.getTransform()
      const base = vec3.one()
      this.tween(0.5, (k) => t.setLocalScale(base.uniformScale(1 + 0.25 * Math.sin(k * Math.PI))))
      return
    }
    this.stage = "doorOpening"
    this.setGuide("")
    // Press the lever down, then swing the door while the lever springs back up.
    this.tween(
      0.25,
      (k) => this.setHandleAngle(40 * (1 - (1 - k) * (1 - k))),
      () => {
        this.tween(0.35, (k) => this.setHandleAngle(40 * (1 - k)))
        const hinge = this.doorHinge.getTransform()
        const start = this.doorHingeHomeRot
        const open = start.multiply(quat.angleAxis(MathUtils.DegToRad * 95, vec3.up()))
        this.tween(0.9, (k) => hinge.setLocalRotation(quat.slerp(start, open, k * k * (3 - 2 * k))), () => this.flashToBathroom())
      },
    )
  }

  /** Lever angle in degrees, pressed downwards (the lever points towards the hinge). */
  private setHandleAngle(deg: number) {
    const q = quat.angleAxis(MathUtils.DegToRad * deg, vec3.forward())
    this.doorHandle.getTransform().setLocalRotation(this.doorHandleHomeRot.multiply(q))
  }

  private flashToBathroom() {
    // A bright white light (white, not black: black is transparent on Specs).
    this.brightLight.enabled = true
    this.setMatAlpha(this.brightMat, 0)
    this.tween(
      0.4,
      (k) => this.setMatAlpha(this.brightMat, k),
      () => {
        this.enterBathroom()
        this.brightLight.enabled = true
        this.tween(
          1.4,
          (k) => this.setMatAlpha(this.brightMat, 1 - k),
          () => (this.brightLight.enabled = false),
        )
      },
    )
  }

  /** The door is open: the bathroom is through it, and the towel goes on the bar next. */
  private enterBathroom() {
    this.stage = "towelToBar"
    this.putTowelText.enabled = true
    this.setGuide(MSG_HANG_TOWEL)
  }

  private startLesson() {
    this.stage = "lesson"
    this.step = 0
    this.lessonText.enabled = false
    this.setProductsInteractive(true)
    this.setGuide(MSG_FIRST)
  }

  // ------------------------------------------------------------------ products

  private onProductGrab(p: Product) {
    if (this.stage !== "lesson" || p.used) return
    p.returning = false
    this.held = p
    // The Learn more button stays until the next product is picked up. The previous tip
    // also clears so it does not sit under the badge.
    this.learnMoreButton.enabled = false
    this.setLearnMore(false)
    this.tipToken++
    this.tipCard.enabled = false

    const correct = p.step === this.step
    if (correct) this.useTargetPos = this.ringPositionFor(p)
    this.badge.enabled = true
    this.badgeText.text = correct ? MSG_CORRECT : MSG_INCORRECT
    this.badgeText.textFill.color = correct ? COLOR_CORRECT : COLOR_INCORRECT
    let hint = ""
    if (correct && this.step === 2) hint = MSG_BODY_CHOICE
    if (!correct) hint = this.hintFor(p)
    this.badgeHint.text = hint
    this.badgeHint.sceneObject.enabled = hint.length > 0
    this.placeBadge(p)
    // The same feedback, larger, on the guide panel; a wrong pick stays up after letting go.
    if (correct) this.setGuide(this.step === 2 ? MSG_LIFT + "\n" + MSG_BODY_CHOICE : MSG_LIFT)
    else this.flashGuide(MSG_INCORRECT + "\n" + hint, COLOR_INCORRECT, 3.5)
  }

  /** What the guide asks for at the current lesson step. */
  private lessonPrompt(): string {
    return this.step === 0 ? MSG_FIRST : MSG_NEXT
  }

  private hintFor(p: Product): string {
    if (this.step === 0) {
      return p.id === "Conditioner" ? "Shampoo comes first, then conditioner." : "Hair first, body last. Start with shampoo."
    }
    if (this.step === 1) return "Hair first, body last. Conditioner is next."
    return "Hair first, body last."
  }

  private onProductRelease(p: Product) {
    if (p.gliding) {
      // Let go while it is on its way to the head: finish the glide, then remove it.
      if (this.held === p) this.held = null
      p.releasedEarly = true
      return
    }
    if (this.held === p) {
      this.held = null
      this.badge.enabled = false
      if (!p.used && this.stage === "lesson") this.setGuide(this.lessonPrompt())
    }
    if (p.used) {
      // Already hidden when it was used; finish removing it now that it is let go.
      this.removeUsed(p)
      return
    }
    this.returnHome(p)
  }

  private removeUsed(p: Product) {
    this.setInteractive(p.interactable, p.manip, false, p.collider)
    p.obj.enabled = false
    this.setVisualsVisible(p, true)
  }

  private childPositions(obj: SceneObject): vec3[] {
    const out: vec3[] = []
    for (let i = 0; i < obj.getChildrenCount(); i++) out.push(obj.getChild(i).getTransform().getLocalPosition())
    return out
  }

  private restoreChildren(p: Product) {
    for (let i = 0; i < p.obj.getChildrenCount() && i < p.childHome.length; i++) {
      p.obj.getChild(i).getTransform().setLocalPosition(p.childHome[i])
    }
  }

  /**
   * Where to lift the product: 18 cm above where it was picked up, at the same distance from
   * the eyes. A mouse drag in the preview keeps that distance, so it can always get there.
   */
  private ringPositionFor(p: Product): vec3 {
    if (!this.camTransform) return p.obj.getTransform().getWorldPosition()
    const cam = this.camTransform.getWorldPosition()
    const b = p.obj.getTransform().getWorldPosition()
    const dir = b.add(new vec3(0, 18, 0)).sub(cam).normalize()
    return cam.add(dir.uniformScale(b.distance(cam)))
  }

  /** Just above the forehead, slightly in front. */
  private headPoint(): vec3 {
    const t = this.camTransform
    return t.getWorldPosition().add(t.up.uniformScale(10)).add(t.back.uniformScale(8))
  }

  /**
   * The product leaves the hand and glides up to the head, then counts as used. Its visuals
   * move, not the object itself, because the hand (or mouse) is still holding the object.
   */
  private glideToHead(p: Product) {
    p.gliding = true
    p.releasedEarly = false
    this.useTarget.enabled = false
    const pt = p.obj.getTransform()
    this.tween(
      0.55,
      (k) => {
        if (!this.camTransform) return
        const e = k * k * (3 - 2 * k)
        const from = pt.getWorldPosition()
        const offset = vec3.lerp(from, this.headPoint(), e).sub(from)
        const local = pt.getWorldRotation().invert().multiplyVec3(offset)
        for (let i = 0; i < p.obj.getChildrenCount() && i < p.childHome.length; i++) {
          p.obj.getChild(i).getTransform().setLocalPosition(p.childHome[i].add(local))
        }
      },
      () => {
        this.restoreChildren(p)
        p.gliding = false
        if (p.used || this.stage !== "lesson") return
        this.useProduct(p)
        if (p.releasedEarly) this.removeUsed(p)
      },
    )
  }

  private setVisualsVisible(p: Product, visible: boolean) {
    for (let i = 0; i < p.obj.getChildrenCount(); i++) p.obj.getChild(i).enabled = visible
  }

  private returnHome(p: Product) {
    p.returning = true
    const t = p.obj.getTransform()
    const fromPos = t.getLocalPosition()
    const fromRot = t.getLocalRotation()
    this.tween(0.35, (k) => {
      if (!p.returning) return
      const e = 1 - (1 - k) * (1 - k)
      t.setLocalPosition(vec3.lerp(fromPos, p.homePos, e))
      t.setLocalRotation(quat.slerp(fromRot, p.homeRot, e))
    }, () => (p.returning = false))
  }

  /** True when the product is inside the use zone in front of the face. */
  public isInFaceZone(pos: vec3): boolean {
    const center = this.faceZone.getTransform().getWorldPosition()
    if (pos.distance(center) <= this.faceZoneRadius) return true
    if (!this.eyeLevelAssist || !this.camTransform) return false
    const cam = this.camTransform.getWorldPosition()
    const toObj = pos.sub(cam)
    const forward = this.camTransform.back // camera looks down -Z
    const ahead = toObj.dot(forward)
    const flat = new vec3(toObj.x, 0, toObj.z).length
    return ahead > 0 && flat <= 95 && pos.y >= cam.y - 3
  }

  private useProduct(p: Product) {
    p.used = true
    p.returning = false
    this.held = null
    this.badge.enabled = false
    // Disappear now; the grab itself ends on release (see onProductRelease).
    this.setVisualsVisible(p, false)
    if (this.splashTrack) {
      this.audio.play(1)
      this.splashPlays++
    }

    const usedStep = this.step
    this.lastUsedStep = usedStep
    this.setGuide("")
    this.guideFlashUntil = 0
    this.showTip(usedStep)
    this.learnMoreButton.enabled = true

    if (usedStep === 2) {
      // The other body product is no longer needed.
      this.products.forEach((o) => {
        if (o.step === 2 && !o.used) this.setInteractive(o.interactable, o.manip, false, o.collider)
      })
      this.stage = "finished"
      // The finish message takes the tip card's place once the last tip has faded.
      this.after(this.tipSeconds + 0.8, () => {
        if (this.stage === "finished") this.showText(this.finishText, MSG_FINISH)
      })
    } else {
      this.step = usedStep + 1
      // Ask for the next product once the tip has had its time.
      this.after(this.tipSeconds + 0.8, () => {
        if (this.stage === "lesson" && this.step === usedStep + 1 && !this.held) this.setGuide(MSG_NEXT)
      })
    }
  }

  private showTip(step: number) {
    const token = ++this.tipToken
    this.tipCard.enabled = true
    this.tipText.text = LESSON[step].tip
    this.setTextAlpha(this.tipText, 1)
    this.setMatAlpha(this.tipBgMat, 0.9)
    this.after(this.tipSeconds, () => {
      if (token !== this.tipToken) return
      this.tween(
        0.7,
        (k) => {
          if (token !== this.tipToken) return
          this.setTextAlpha(this.tipText, 1 - k)
          this.setMatAlpha(this.tipBgMat, 0.9 * (1 - k))
        },
        () => {
          if (token === this.tipToken) this.tipCard.enabled = false
        },
      )
    })
  }

  // ------------------------------------------------------------------ learn more

  public toggleLearnMore() {
    if (!this.learnMoreButton.enabled || this.lastUsedStep < 0) return
    this.setLearnMore(!this.learnMoreOpen)
  }

  private setLearnMore(open: boolean) {
    this.learnMoreOpen = open
    this.learnMorePanel.enabled = open
    if (open) {
      const c = LESSON[this.lastUsedStep]
      this.learnMoreTitle.text = c.title
      this.learnMoreBody.text = c.more
    }
  }

  // ------------------------------------------------------------------ towel marker

  private addMarker(root: string, arrow: string | null, ring: string | null, show: () => boolean) {
    const m: Marker = {root: this.find(root), show}
    if (arrow) {
      m.arrow = this.find(arrow).getTransform()
      m.arrowBase = m.arrow.getLocalPosition()
    }
    if (ring) {
      m.ring = this.find(ring).getTransform()
      m.ringBase = m.ring.getLocalScale()
    }
    m.root.enabled = false
    this.markers.push(m)
  }

  /** Glowing hints bob and pulse while they are needed. */
  private updateMarkers(now: number) {
    const bob = Math.sin(now * Math.PI * 1.6)
    const pulse = 1 + 0.12 * Math.sin(now * Math.PI * 2.4)
    for (const m of this.markers) {
      const show = m.show()
      if (m.root.enabled !== show) m.root.enabled = show
      if (!show) continue
      if (m.arrow) m.arrow.setLocalPosition(m.arrowBase.add(new vec3(0, 4 * bob, 0)))
      if (m.ring) m.ring.setLocalScale(new vec3(m.ringBase.x * pulse, m.ringBase.y, m.ringBase.z * pulse))
    }
  }

  // ------------------------------------------------------------------ guide panel

  /** The standing instruction ("" hides the panel). */
  private setGuide(message: string) {
    this.guideMessage = message
  }

  /** Feedback that replaces the instruction for a few seconds. */
  private flashGuide(message: string, color: vec4, seconds: number) {
    this.guideFlash = message
    this.guideFlashColor = color
    this.guideFlashUntil = getTime() + seconds
  }

  /** The text the guide panel is showing right now (read by the LEAF scenarios). */
  public get guideShowing(): string {
    return this.guidePanel.enabled ? this.guideText.text : ""
  }

  private updateGuide(dt: number) {
    if (!this.camTransform) return
    const flashing = getTime() < this.guideFlashUntil
    const message = flashing ? this.guideFlash : this.guideMessage
    const show = message.length > 0 && !this.learnMoreOpen && !this.lessonText.enabled
    if (!show) {
      if (this.guidePanel.enabled) this.guidePanel.enabled = false
    } else {
      const appearing = !this.guidePanel.enabled
      this.guidePanel.enabled = true
      if (this.guideText.text !== message) this.guideText.text = message
      this.guideText.textFill.color = flashing ? this.guideFlashColor : COLOR_GUIDE
      if (appearing) this.placeInFront(this.guidePanel)
      else this.lazyFollow(this.guidePanel, dt)
    }
    if (this.lessonText.enabled) this.lazyFollow(this.lessonText, dt)
  }

  /**
   * 70 cm along where the user is looking (up or down too, within limits), above the line of
   * sight so it does not cover what they are looking at, and facing them.
   */
  private frontPose(): {pos: vec3; rot: quat} {
    const cam = this.camTransform.getWorldPosition()
    const look = this.camTransform.back
    const flat = new vec3(look.x, 0, look.z)
    const flatLen = flat.length
    const h = flatLen > 0.001 ? flat.uniformScale(1 / flatLen) : new vec3(0, 0, -1)
    const pitch = Math.min(MathUtils.DegToRad * 25, Math.max(MathUtils.DegToRad * -40, Math.atan2(look.y, flatLen)))
    const dir = h.uniformScale(Math.cos(pitch)).add(new vec3(0, Math.sin(pitch), 0))
    // Upper part of the view (about 11 degrees above the line of sight).
    const pos = cam.add(dir.uniformScale(70)).add(this.camTransform.up.uniformScale(14))
    return {pos, rot: quat.lookAt(cam.sub(pos).normalize(), vec3.up())}
  }

  private placeInFront(obj: SceneObject) {
    if (!this.camTransform) return
    const pose = this.frontPose()
    obj.getTransform().setWorldPosition(pose.pos)
    obj.getTransform().setWorldRotation(pose.rot)
    this.following.delete(obj)
  }

  /** Panels stay put while you look around them, and drift back in front once you turn away. */
  private lazyFollow(obj: SceneObject, dt: number) {
    const t = obj.getTransform()
    const pose = this.frontPose()
    const cam = this.camTransform.getWorldPosition()
    const a = t.getWorldPosition().sub(cam)
    const b = pose.pos.sub(cam)
    const angle = a.length > 0.001 ? a.angleTo(b) * MathUtils.RadToDeg : 180
    const far = Math.abs(a.length - b.length) > 35
    if (angle > 18 || far) this.following.add(obj)
    if (!this.following.has(obj)) return
    const k = 1 - Math.exp(-4 * dt)
    t.setWorldPosition(vec3.lerp(t.getWorldPosition(), pose.pos, k))
    t.setWorldRotation(quat.slerp(t.getWorldRotation(), pose.rot, k))
    if (t.getWorldPosition().distance(pose.pos) < 2) this.following.delete(obj)
  }

  // ------------------------------------------------------------------ lesson starts in the tub

  private updateTubEntry() {
    if (this.stage !== "toTub" || !this.camTransform) return
    const root = this.sceneObject.getTransform().getWorldPosition()
    const cam = this.camTransform.getWorldPosition()
    const x = cam.x - root.x
    const z = cam.z - root.z
    const m = 8
    if (x > TUB.x0 + m && x < TUB.x1 - m && z > TUB.z0 + m && z < TUB.z1 - m) this.startLesson()
  }

  /** While the right product is held, a glowing ring shows where to lift it. */
  private updateUseTarget() {
    const p = this.held
    const show = !!p && this.stage === "lesson" && p.step === this.step && !p.used && !p.gliding && !!this.camTransform
    if (this.useTarget.enabled !== show) this.useTarget.enabled = show
    if (!show) return
    const t = this.useTarget.getTransform()
    t.setWorldPosition(this.useTargetPos)
    const toCam = this.camTransform.getWorldPosition().sub(this.useTargetPos)
    if (toCam.length > 0.001) t.setWorldRotation(quat.lookAt(toCam.normalize(), vec3.up()))
    if (p.obj.getTransform().getWorldPosition().distance(this.useTargetPos) <= 10) this.glideToHead(p)
  }

  // ------------------------------------------------------------------ staying inside the rooms

  /**
   * The rooms' floor plan in Rooms-local cm (x, z), matching Tools/blender/build_props.py.
   * The device can't stop someone walking through a virtual wall, so when the user leaves the
   * floor plan the rooms fade out (revealing their real surroundings on Specs) and a message
   * tells them which way to walk back.
   */
  private static readonly BEDROOM = {x0: -180, x1: 360, z0: -195, z1: 337.5}
  private static readonly BATHROOM = {x0: -140, x1: 130, z0: -557.5, z1: -205}
  private static readonly DOORWAY = {x0: -76, x1: 6, z0: -205, z1: -195}

  private doorIsOpen(): boolean {
    return this.stage !== "opening" && this.stage !== "doorOpening"
  }

  /** Nearest walkable point to (x, z), or null when (x, z) is already walkable. */
  private nearestWalkable(x: number, z: number): vec2 | null {
    const m = this.wallMargin
    const rooms = [RinseRepeatController.BEDROOM]
    if (this.doorIsOpen()) rooms.push(RinseRepeatController.BATHROOM)
    let best: vec2 | null = null
    let bestD = Number.MAX_VALUE
    for (const r of rooms) {
      const px = Math.min(Math.max(x, r.x0 + m), r.x1 - m)
      const pz = Math.min(Math.max(z, r.z0 + m), r.z1 - m)
      if (px === x && pz === z) return null
      const d = (px - x) * (px - x) + (pz - z) * (pz - z)
      if (d < bestD) {
        bestD = d
        best = new vec2(px, pz)
      }
    }
    // The open doorway joins the rooms (narrowed by a few cm so the frame still counts as wall).
    const dw = RinseRepeatController.DOORWAY
    if (this.doorIsOpen() && x > dw.x0 + 5 && x < dw.x1 - 5 && z > dw.z0 - m - 1 && z < dw.z1 + m + 1) return null
    return best
  }

  private updateBoundary(dt: number) {
    if (!this.camTransform) return
    const root = this.sceneObject.getTransform().getWorldPosition()
    const cam = this.camTransform.getWorldPosition()
    const target = this.nearestWalkable(cam.x - root.x, cam.z - root.z)
    this.outOfBounds = target !== null

    const goal = this.outOfBounds ? 1 : 0
    const rate = this.outOfBounds ? 2.5 : 4
    const step = rate * dt
    this.boundaryFade = Math.abs(goal - this.boundaryFade) <= step ? goal : this.boundaryFade + Math.sign(goal - this.boundaryFade) * step
    const visible = this.boundaryFade > 0
    if (this.boundaryWarning.enabled !== visible) this.boundaryWarning.enabled = visible
    if (!visible) return

    if (target) {
      // Which way to walk, relative to where the user is looking.
      const to = new vec3(target.x + root.x - cam.x, 0, target.y + root.z - cam.z)
      const look = this.camTransform.back
      const fwd = new vec3(look.x, 0, look.z).normalize()
      const right = new vec3(-fwd.z, 0, fwd.x)
      const ahead = to.dot(fwd)
      const side = to.dot(right)
      let hint = "Walk forward"
      if (ahead < 0 && Math.abs(side) < -ahead) hint = "Turn around"
      else if (Math.abs(side) > Math.abs(ahead)) hint = side > 0 ? "Turn right" : "Turn left"
      this.boundaryText.text = "You've left the room.\n" + hint + " to step back inside."
    }
    const a = this.boundaryFade
    this.boundaryText.textFill.color = new vec4(1, 1, 1, a)
    this.boundaryText.backgroundSettings.fill.color = new vec4(0, 0, 0, 0.92 * a)
  }

  // ------------------------------------------------------------------ per frame

  private onUpdate() {
    const dt = getDeltaTime()
    const now = getTime()

    if (this.timers.length > 0) {
      const due = this.timers.filter((t) => t.at <= now)
      this.timers = this.timers.filter((t) => t.at > now)
      due.forEach((t) => t.fn())
    }

    if (this.tweens.length > 0) {
      const active = this.tweens
      this.tweens = []
      const keep: Tween[] = []
      active.forEach((tw) => {
        tw.elapsed += dt
        const k = Math.min(1, tw.elapsed / tw.duration)
        tw.update(k)
        if (k >= 1) {
          if (tw.done) tw.done()
        } else {
          keep.push(tw)
        }
      })
      this.tweens = keep.concat(this.tweens)
    }

    this.updateTowel(dt)
    this.updateMarkers(now)
    this.updateGuide(dt)
    this.updateTubEntry()
    this.updateUseTarget()
    this.updateBoundary(dt)

    const p = this.held
    if (p && this.stage === "lesson") {
      this.placeBadge(p)
      if (!p.gliding && p.step === this.step && this.isInFaceZone(p.obj.getTransform().getWorldPosition())) {
        this.useProduct(p)
      }
    }
  }

  private placeBadge(p: Product) {
    const above = p.id === "BarSoap" ? 9 : 16
    const pos = p.obj.getTransform().getWorldPosition().add(new vec3(0, above, 0))
    const t = this.badge.getTransform()
    t.setWorldPosition(pos)
    if (this.camTransform) {
      const toCam = this.camTransform.getWorldPosition().sub(pos)
      toCam.y = 0
      if (toCam.length > 0.001) t.setWorldRotation(quat.lookAt(toCam.normalize(), vec3.up()))
    }
  }

  // ------------------------------------------------------------------ helpers

  private resetLessonUi() {
    this.putTowelText.enabled = false
    this.lessonText.enabled = false
    this.finishText.enabled = false
    this.tipCard.enabled = false
    this.learnMoreButton.enabled = false
    this.setLearnMore(false)
    this.badge.enabled = false
  }

  private resetProducts() {
    this.products.forEach((p) => {
      p.used = false
      p.returning = false
      p.gliding = false
      p.releasedEarly = false
      this.restoreChildren(p)
      p.obj.enabled = true
      this.setVisualsVisible(p, true)
      p.obj.getTransform().setLocalPosition(p.homePos)
      p.obj.getTransform().setLocalRotation(p.homeRot)
    })
  }

  private setProductsInteractive(on: boolean) {
    this.products.forEach((p) => this.setInteractive(p.interactable, p.manip, on && !p.used, p.collider))
  }

  private setInteractive(i: Interactable, m: InteractableManipulation, on: boolean, collider?: ColliderComponent) {
    i.enabled = on
    if (m) m.enabled = on
    const c = collider || (i.getSceneObject().getComponent("Physics.ColliderComponent") as ColliderComponent)
    if (c) c.enabled = on
  }

  private clearPending() {
    this.tweens = []
    this.timers = []
    this.tipToken++
    this.lessonToken++
  }

  private showText(obj: SceneObject, value: string) {
    obj.enabled = true
    const t = obj.getComponent("Component.Text") as Text
    t.text = value
    this.setTextAlpha(t, 1)
  }

  private fadeTextOut(obj: SceneObject, seconds: number, done?: () => void) {
    const t = obj.getComponent("Component.Text") as Text
    this.tween(seconds, (k) => this.setTextAlpha(t, 1 - k), () => {
      obj.enabled = false
      this.setTextAlpha(t, 1)
      if (done) done()
    })
  }

  private setTextAlpha(t: Text, a: number) {
    const c = t.textFill.color
    t.textFill.color = new vec4(c.x, c.y, c.z, a)
  }

  private setMatAlpha(m: Material, a: number) {
    const c = m.mainPass.baseColor
    m.mainPass.baseColor = new vec4(c.x, c.y, c.z, a)
  }

  private cloneMaterial(obj: SceneObject): Material {
    const rmv = obj.getComponent("Component.RenderMeshVisual")
    rmv.mainMaterial = rmv.mainMaterial.clone()
    return rmv.mainMaterial
  }

  private tween(duration: number, update: (t: number) => void, done?: () => void) {
    this.tweens.push({duration, elapsed: 0, update, done})
  }

  private after(seconds: number, fn: () => void) {
    this.timers.push({at: getTime() + seconds, fn})
  }

  private makeCollider(obj: SceneObject, size: vec3): ColliderComponent {
    let col = obj.getComponent("Physics.ColliderComponent") as ColliderComponent
    if (!col) col = obj.createComponent("Physics.ColliderComponent") as ColliderComponent
    const shape = Shape.createBoxShape()
    shape.size = size
    col.shape = shape
    col.fitVisual = false
    return col
  }

  private makePinchable(obj: SceneObject, size: vec3): Interactable {
    this.makeCollider(obj, size)
    // No hover growth here: the bar and handle are fixed fittings; glowing markers point them out.
    return obj.createComponent(Interactable.getTypeName()) as Interactable
  }

  private makeGrabbable(obj: SceneObject, size: vec3) {
    const collider = this.makeCollider(obj, size)
    const interactable = obj.createComponent(Interactable.getTypeName()) as Interactable
    const manip = obj.createComponent(InteractableManipulation.getTypeName()) as InteractableManipulation
    manip.setCanRotate(false)
    manip.setCanScale(false)
    // Everything is within arm's reach at real scale, so move objects 1:1 with the hand.
    manip.enableStretchZ = false
    this.addHoverHighlight(obj, interactable)
    return {interactable, manip, collider}
  }

  /** Targets grow slightly when aimed at. */
  private addHoverHighlight(obj: SceneObject, i: Interactable) {
    const t = obj.getTransform()
    const base = t.getLocalScale()
    this.createEvent("OnStartEvent").bind(() => {
      i.onHoverEnter.add(() => t.setLocalScale(base.uniformScale(1.1)))
      i.onHoverExit.add(() => t.setLocalScale(base))
    })
  }

  private find(name: string): SceneObject {
    const found = this.findIn(this.sceneObject, name) || this.findGlobal(name)
    if (!found) throw new Error(`RinseRepeat: scene object "${name}" not found`)
    return found
  }

  private findGlobal(name: string): SceneObject | null {
    const scene = global.scene
    for (let i = 0; i < scene.getRootObjectsCount(); i++) {
      const r = this.findIn(scene.getRootObject(i), name)
      if (r) return r
    }
    return null
  }

  private findIn(obj: SceneObject, name: string): SceneObject | null {
    if (obj.name === name) return obj
    for (let i = 0; i < obj.getChildrenCount(); i++) {
      const r = this.findIn(obj.getChild(i), name)
      if (r) return r
    }
    return null
  }

  private textOf(name: string): Text {
    return this.find(name).getComponent("Component.Text") as Text
  }
}
