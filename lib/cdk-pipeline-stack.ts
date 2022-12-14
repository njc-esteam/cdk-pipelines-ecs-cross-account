import { Stack, StackProps, SecretValue } from 'aws-cdk-lib';
import { CodePipeline, CodePipelineSource, ShellStep, ManualApprovalStep } from 'aws-cdk-lib/pipelines';
import { Construct } from 'constructs';
import { BaseStage } from './base-stage';
import { Params } from './params';

export class CdkPipelineStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const pipeline = new CodePipeline(this, 'Pipeline', {
      crossAccountKeys: true,
      synth: new ShellStep('Synth', {
        input: CodePipelineSource.gitHub(Params.GITHUB_REPO, Params.BRANCH_NAME, {
          authentication: SecretValue.secretsManager(Params.GITHUB_TOKEN)
        }),
        commands: ['npm ci', 'npm run build', 'npx cdk synth']
      })
    });

    const devStage = new BaseStage(this, 'DevStage', {
      env: {
        account: Params.DEV_ACCOUNT_ID,
        region: Params.AWS_REGION_PROD
      },
      customGreeting: 'Hi from Dev account',
      bg: '#FF0000'
    });

    // const stagingStage = new BaseStage(this, 'StagingStage', {
    //   env: {
    //     account: Params.STAGING_ACCOUNT_ID,
    //     region: Params.AWS_REGION_STAGING
    //   },
    //   customGreeting: 'Hi from Staging account',
    //   bg: '#00FF00'
    // });

    const prodStage = new BaseStage(this, 'ProdStage', {
      env: {
        account: Params.PROD_ACCOUNT_ID,
        region: Params.AWS_REGION_PROD
      },
      customGreeting: 'Hi from Prod account',
      bg: '#0000FF'
    });
    

    const pipelineDevStage = pipeline.addStage(devStage);
    pipelineDevStage.addPost(new ShellStep("albTestd", {
      envFromCfnOutputs: {albAddress: devStage.albAddress},
      commands: ['curl -f -s -o /dev/null -w "%{http_code}" $albAddress'] 
    }));

    // const pipelineStagingStage = pipeline.addStage(stagingStage);
    // pipelineStagingStage.addPost(new ShellStep("albTest", {
    //   envFromCfnOutputs: {albAddress: stagingStage.albAddress},
    //   commands: ['curl -f -s -o /dev/null -w "%{http_code}" $albAddress']
    // }));
    
    const pipelineProdStage = pipeline.addStage(prodStage);   

    pipelineProdStage.addPre(new ManualApprovalStep('ManualApproval', {}));

  }
}
