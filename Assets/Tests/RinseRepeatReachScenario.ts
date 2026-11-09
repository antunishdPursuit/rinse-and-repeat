import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {createIKInteractor} from "Leaf.lspkg/Interactors/interactor/ik/visualizer/BitmojiAvatar"
import {controller, interactable, visible, waitFor} from "./RinseRepeatTestUtils"

/**
 * Reachability check with a simulated arm and head (IK): a standing user can reach the
 * shampoo on the shelf, lift it toward their face, and pinch "Learn more".
 * A trigger that fails to converge means a control is out of reach.
 */
@component
export class ReachScenario extends Scenario {
  private readonly ik = createIKInteractor()

  async run(): Promise<void> {
    const c = controller()
    c.jumpToLesson()
    await sleep(800)

    // Reach the shampoo and lift it up toward the face (world-space cm).
    await this.ik.drag(interactable("Shampoo"), new vec3(-4, 20, 30))
    const used = await waitFor(() => c.lastUsedStep === 0, 3000)
    expect(used, "IK hand can lift the shampoo into the use zone").toBe(true)

    await sleep(800)
    expect(visible("LearnMoreButton"), "Learn more button shows").toBe(true)
    await this.ik.trigger(interactable("LearnMoreButton"))
    await sleep(400)
    expect(visible("LearnMorePanel"), "IK hand can pinch Learn more").toBe(true)
  }
}
