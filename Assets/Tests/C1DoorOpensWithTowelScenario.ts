import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {RinseRepeatInteractor} from "./RinseRepeatInteractor"
import {
  MSG_BODY_CHOICE,
  MSG_CORRECT,
  MSG_FINISH,
  MSG_INCORRECT,
  MSG_LEARN,
  MSG_OPEN_DOOR,
} from "../Scripts/RinseRepeatController"
import {
  angleDeg,
  cameraPos,
  controller,
  distToSegment,
  dragTowelToBar,
  interactable,
  obj,
  pickUpAndRelease,
  textOf,
  useProduct,
  visible,
  waitFor,
  worldPos,
} from "./RinseRepeatTestUtils"

/**
 * Done criterion 1: grabbing the towel from the bed and pinching the bathroom door handle
 * opens the door; a bright light fades to show the bathroom. Once picked up, the towel
 * hangs like cloth and stays with the user.
 */
@component
export class DoorOpensWithTowelScenario extends Scenario {
  async run(): Promise<void> {
    const c = controller()
    const interactor = new RinseRepeatInteractor()
    c.resetToOpening()
    await sleep(500)

    expect(visible("TowelSign"), "towel reminder sign shows at start").toBe(true)
    expect(visible("TowelMarker"), "glowing marker shows over the towel at start").toBe(true)

    // Guard: the handle does nothing until the towel has been picked up.
    await interactor.trigger(interactable("DoorHandle"))
    await sleep(400)
    expect(c.stage, "door stays shut without the towel").toBe("opening")

    // Grab the towel.
    await interactor.carry(interactable("Towel"), new vec3(0, 3, 0), 600)
    await sleep(200)
    expect(c.towelTaken, "towel counts as taken").toBe(true)
    expect(visible("TowelSign"), "reminder sign hides once the towel is picked up").toBe(false)
    expect(visible("TowelMarker"), "marker hides once the towel is picked up").toBe(false)
    expect(visible("HandleMarker"), "the door handle glows once you have the towel").toBe(true)
    expect(c.guideShowing, "guide says to open the door").toBe(MSG_OPEN_DOOR)

    // The carried towel must not sit on the line of sight to the handle, or a click on the
    // handle lands on the towel instead. Check from the start and from 80 cm in front of the door.
    const root = c.getSceneObject().getTransform()
    for (const dz of [0, 115]) {
      root.setWorldPosition(new vec3(0, 0, dz))
      await sleep(1200)
      const gap = distToSegment(worldPos("Towel"), cameraPos(), worldPos("DoorHandle"))
      expect(gap > 22, `carried towel is clear of the handle sight line (${dz ? "close" : "start"}, ${gap.toFixed(1)} cm)`).toBe(true)
    }
    root.setWorldPosition(vec3.zero())
    await sleep(300)
    expect(c.towelState, "let go, the towel stays with the user").toBe("carried")
    expect(visible("TowelHanging"), "towel hangs unfolded").toBe(true)
    expect(visible("TowelFolded"), "folded towel is gone from the bed").toBe(false)

    // Pinch the handle: the lever turns down, the door opens and the bright light comes up.
    const lever = obj("DoorHandle").getTransform()
    let leverTurned = false
    const watch = waitFor(() => (leverTurned = leverTurned || angleDeg(lever.getLocalRotation()) > 25), 2500)
    await interactor.trigger(interactable("DoorHandle"))
    await watch
    expect(leverTurned, "door lever turns down when pinched").toBe(true)
    const lightShown = await waitFor(() => visible("BrightLight"), 2500)
    expect(lightShown, "bright light appears after the door opens").toBe(true)

    // The light fades and reveals the bathroom.
    const lightGone = await waitFor(() => !visible("BrightLight"), 4000)
    expect(lightGone, "bright light fades away").toBe(true)
    expect(visible("Bathroom"), "bathroom is shown").toBe(true)
    expect(visible("PutTowelText"), "towel bar prompt shows").toBe(true)
    expect(c.towelState, "towel is still carried after walking through").toBe("carried")
    expect(c.stage).toBe("towelToBar")
  }
}
