import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import WorldCameraFinderProvider from "SpectaclesInteractionKit.lspkg/Providers/CameraProvider/WorldCameraFinderProvider"
import {controller, textOf, visible, waitFor} from "./RinseRepeatTestUtils"

/**
 * Leaving the rooms (through a wall, or through the closed bathroom door) fades the rooms out
 * and asks the user to step back inside; coming back clears the warning. The user's position
 * is simulated by moving the rooms under the camera.
 */
@component
export class StayInsideScenario extends Scenario {
  async run(): Promise<void> {
    const c = controller()
    const root = c.getSceneObject().getTransform()
    const cam = WorldCameraFinderProvider.getInstance().getTransform()
    /** Move the rooms so the camera stands at Rooms-local (x, z). */
    const standAt = (x: number, z: number) => {
      const p = cam.getWorldPosition()
      root.setWorldPosition(new vec3(p.x - x, 0, p.z - z))
    }

    c.resetToOpening()
    await sleep(300)
    expect(c.outOfBounds, "the start position is inside the bedroom").toBe(false)
    expect(visible("BoundaryWarning"), "no warning at the start").toBe(false)

    // Through the bedroom's left wall.
    standAt(-230, 0)
    const warned = await waitFor(() => c.outOfBounds && visible("BoundaryWarning"), 1000)
    expect(warned, "walking through a wall shows the warning").toBe(true)
    expect(textOf("BoundaryWarning").indexOf("step back inside") >= 0, "warning says how to get back").toBe(true)

    // Back inside: the warning fades away.
    standAt(0, 0)
    const cleared = await waitFor(() => !c.outOfBounds && !visible("BoundaryWarning"), 1500)
    expect(cleared, "stepping back in clears the warning").toBe(true)

    // Into the bathroom through the closed door.
    standAt(-35, -300)
    const blocked = await waitFor(() => c.outOfBounds, 1000)
    expect(blocked, "the bathroom is off limits while the door is shut").toBe(true)

    // Once the door is open the bathroom is part of the walkable space.
    c.jumpToLesson()
    await sleep(300)
    expect(c.outOfBounds, "standing in the tub after the door opens is inside").toBe(false)

    c.resetToOpening()
    await waitFor(() => !visible("BoundaryWarning"), 1500)
  }
}
