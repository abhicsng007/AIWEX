import { FrontendApplicationContribution } from '@theia/core/lib/browser'
import { ContainerModule } from '@theia/core/shared/inversify'
import { AiwexTheiaBridgeContribution } from './aiwex-theia-bridge-contribution'

export default new ContainerModule(bind => {
  bind(AiwexTheiaBridgeContribution).toSelf().inSingletonScope()
  bind(FrontendApplicationContribution).toService(AiwexTheiaBridgeContribution)
})
