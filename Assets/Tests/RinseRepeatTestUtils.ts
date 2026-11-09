import {Interactable} from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable"
import {RinseRepeatInteractor} from "./RinseRepeatInteractor"
import {findInteractableByName} from "Leaf.lspkg/Interactors/InteractableUtils"
import {findSceneObjectByName, sleep} from "Leaf.lspkg/Utils/common/Utils"
import {RinseRepeatController} from "../Scripts/RinseRepeatController"
import WorldCameraFinderProvider from "SpectaclesInteractionKit.lspkg/Providers/CameraProvider/WorldCameraFinderProvider"

/** Shared helpers for the Rinse & Repeat LEAF scenarios. */

export function controller(): RinseRepeatController {
  const root = findSceneObjectByName("RinseRepeat")
  if (!root) throw new Error("RinseRepeat root not found")
  return root.getComponent(RinseRepeatController.getTypeName()) as RinseRepeatController
}

export function obj(name: string): SceneObject {
  const o = findSceneObjectByName(name)
  if (!o) throw new Error(`Scene object "${name}" not found`)
  return o
}

export function textOf(name: string): string {
  return (obj(name).getComponent("Component.Text") as Text).text
}

/** True when the object and all its parents are enabled. */
export function visible(name: string): boolean {
  return obj(name).isEnabledInHierarchy
}

export function worldPos(name: string): vec3 {
  return obj(name).getTransform().getWorldPosition()
}

export function interactable(name: string): Interactable {
  const i = findInteractableByName(name)
  if (!i) throw new Error(`Interactable "${name}" not found`)
  return i
}

export interface HeldSnapshot {
  badgeVisible: boolean
  badgeText: string
  hintText: string
  hintVisible: boolean
  guide: string
  useTargetVisible: boolean
}

/**
 * Pick up a product (grab with a tiny drag), take a snapshot of the badge while it is
 * held, then let go.
 */
export async function pickUpAndRelease(interactor: RinseRepeatInteractor, name: string): Promise<HeldSnapshot> {
  let snap = emptySnapshot()
  const drag = interactor.carry(interactable(name), new vec3(0, 2, 0), 1000)
  // The grab starts after LEAF's short hover phase; wait for it, then look at the badge.
  await waitFor(() => visible("Badge"), 1500)
  await sleep(100)
  snap = {
    badgeVisible: visible("Badge"),
    badgeText: textOf("BadgeText"),
    hintText: textOf("BadgeHint"),
    hintVisible: visible("BadgeHint"),
    guide: controller().guideShowing,
    useTargetVisible: visible("UseTarget"),
  }
  await drag
  return snap
}

function emptySnapshot(): HeldSnapshot {
  return {badgeVisible: false, badgeText: "", hintText: "", hintVisible: false, guide: "", useTargetVisible: false}
}

/** Move the rooms so the camera stands over `spot` (as if the user walked there). */
export function standAt(spot: string) {
  const c = controller()
  const root = c.getSceneObject().getTransform()
  root.setWorldPosition(vec3.zero())
  const cam = WorldCameraFinderProvider.getInstance().getTransform().getWorldPosition()
  const p = worldPos(spot)
  root.setWorldPosition(new vec3(cam.x - p.x, 0, cam.z - p.z))
}

/** Grab a product and lift it into the use ring: 18 cm up, same distance from the eyes. */
export async function liftIntoRing(interactor: RinseRepeatInteractor, name: string): Promise<void> {
  const from = worldPos(name)
  const cam = WorldCameraFinderProvider.getInstance().getTransform().getWorldPosition()
  const dir = from.add(new vec3(0, 18, 0)).sub(cam).normalize()
  const target = cam.add(dir.uniformScale(from.distance(cam)))
  await interactor.carry(interactable(name), target.sub(from), 1200)
  await sleep(200)
}

/** Distance from point p to the segment a-b. */
export function distToSegment(p: vec3, a: vec3, b: vec3): number {
  const ab = b.sub(a)
  const t = Math.max(0, Math.min(1, p.sub(a).dot(ab) / Math.max(1e-6, ab.dot(ab))))
  return p.distance(a.add(ab.uniformScale(t)))
}

export function cameraPos(): vec3 {
  return WorldCameraFinderProvider.getInstance().getTransform().getWorldPosition()
}

/** Rotation angle of a quaternion, in degrees. */
export function angleDeg(q: quat): number {
  return (2 * Math.acos(Math.min(1, Math.abs(q.w))) * 180) / Math.PI
}

/**
 * Grab a product and drag it in a straight line through the face zone in front of the
 * user's face, then let go. Returns the badge snapshot taken early in the grab.
 */
export async function useProduct(interactor: RinseRepeatInteractor, name: string): Promise<HeldSnapshot> {
  const from = worldPos(name)
  const to = worldPos("FaceZone")
  // Aim slightly past the zone centre so the path goes through the middle of the zone.
  const move = to.sub(from).uniformScale(1.1)
  let snap = emptySnapshot()
  const drag = interactor.carry(interactable(name), move, 1400)
  // Grab the badge text in the first frames of the grab, before the product reaches the zone.
  for (let i = 0; i < 120; i++) {
    await sleep(16)
    if (visible("Badge")) {
      snap = {
        badgeVisible: true,
        badgeText: textOf("BadgeText"),
        hintText: textOf("BadgeHint"),
        hintVisible: visible("BadgeHint"),
        guide: controller().guideShowing,
        useTargetVisible: visible("UseTarget"),
      }
      break
    }
  }
  await drag
  await sleep(200)
  return snap
}

/** Carry the towel to the bar and let go; retry a few times if it lands short. */
export async function dragTowelToBar(interactor: RinseRepeatInteractor): Promise<void> {
  const c = controller()
  for (let round = 0; round < 4 && !c.towelOnBar; round++) {
    const delta = worldPos("TowelBarSpot").sub(worldPos("Towel"))
    await interactor.carry(interactable("Towel"), delta, 1200)
    // Released near the bar, the towel flies over it (about 0.7 s).
    await waitFor(() => c.towelOnBar, 1500)
    print(`[towel] round ${round} dist=${worldPos("TowelBarSpot").distance(worldPos("Towel")).toFixed(1)} onBar=${c.towelOnBar}`)
  }
}

export async function waitFor(cond: () => boolean, timeoutMs: number): Promise<boolean> {
  const end = getTime() * 1000 + timeoutMs
  while (getTime() * 1000 < end) {
    if (cond()) return true
    await sleep(50)
  }
  return cond()
}
