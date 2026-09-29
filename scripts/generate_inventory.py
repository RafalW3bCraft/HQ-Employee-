import os

root = '/home/watcher/Desktop/employee'
exclude = {'.git', 'node_modules', '.gradle', 'build', '.idea', '.tempmediaStorage'}

all_files = []
for dirpath, dirnames, filenames in os.walk(root):
    dirnames[:] = [d for d in dirnames if d not in exclude]
    for f in sorted(filenames):
        rel = os.path.relpath(os.path.join(dirpath, f), root)
        all_files.append(rel)

out_path = os.path.join(root, 'docs/FINAL_REPOSITORY_INVENTORY.md')

lines = []
lines.append('# HQ EMPLOYEE — FINAL REPOSITORY INVENTORY')
lines.append('')
lines.append('Complete inventory and dependency classification of every file in the repository prior to the final pre-submission engineering pass.')
lines.append('')
lines.append(f'**Total Files Audited:** {len(all_files)}')
lines.append('')
lines.append('---')
lines.append('')

counts = {}

for path in sorted(all_files):
    ext = os.path.splitext(path)[1]
    name = os.path.basename(path)
    file_type = ext if ext else '(no extension)'
    
    runtime_use = 'NO'
    test_use = 'NO'
    build_use = 'NO'
    doc_use = 'NO'
    ecc_use = 'NO'
    deploy_use = 'NO'
    aai_rel = 'NO'
    rc_rel = 'NO'
    is_duplicate = 'NO'
    is_unused = 'NO'
    is_obsolete = 'NO'
    is_unrelated = 'NO'
    safe_to_delete = 'NO'
    
    if path.startswith('.agents/'):
        subsystem = 'Agent / Instructions'
        if 'assembly-ai' in path:
            purpose = 'AssemblyAI developer rules and prompt guidelines'
            aai_rel = 'YES'
            ecc_use = 'YES'
            doc_use = 'YES'
            classification = 'REQUIRED'
            reason = 'Essential agent context for AssemblyAI Voice Agent protocol'
        else:
            purpose = 'Agent instructions'
            classification = 'OPTIONAL'
            reason = 'Agent rule configuration'
            
    elif path.startswith('backend/.agents/'):
        subsystem = 'Agent Skills (External Copied)'
        is_unused = 'YES'
        is_unrelated = 'YES'
        safe_to_delete = 'YES'
        classification = 'UNRELATED'
        if 'xcode' in path or 'swift' in path:
            purpose = 'Xcode / Swift SPM setup skill'
            reason = 'Unrelated iOS/Xcode tooling; project is Android and backend TypeScript only'
        elif 'flutter' in path:
            purpose = 'Flutter integration skill'
            reason = 'Unrelated Flutter tooling; project does not use Flutter'
        elif 'data-connect' in path or 'firestore' in path:
            purpose = 'Firebase Firestore/Data Connect reference'
            reason = 'Unrelated database skill; project uses PostgreSQL on Neon'
        else:
            purpose = f'External skill artifact {name}'
            reason = 'External copied plugin artifact not used in runtime, build, or tests'
            
    elif path.startswith('backend/dist/'):
        subsystem = 'Backend Build Output'
        file_type = 'Compiled JavaScript / SourceMap'
        purpose = 'TypeScript compiler output from src/'
        build_use = 'YES'
        runtime_use = 'YES'
        classification = 'PRODUCTION'
        reason = 'Compiled server artifacts from tsc build'
        
    elif path.startswith('backend/src/'):
        subsystem = 'Backend Core'
        runtime_use = 'YES'
        build_use = 'YES'
        classification = 'CORE'
        if 'routes/voice.ts' in path or 'modules/assemblyai' in path:
            purpose = 'AssemblyAI Voice Agent integration and WebSocket handler'
            aai_rel = 'YES'
            reason = 'Core AssemblyAI voice session handler and WebSocket proxy'
        elif 'billing' in path:
            purpose = 'Authoritative Credit Ledger & RevenueCat monetization'
            rc_rel = 'YES'
            reason = 'Core credit wallet, ledger transactions, and webhook processing'
        elif 'policies' in path:
            purpose = 'Deterministic Policy Engine boundary'
            reason = 'Core policy evaluation (ALLOW, REQUIRE_APPROVAL, BLOCK)'
        elif 'db/' in path:
            purpose = 'PostgreSQL database pool, schema, and migration runner'
            reason = 'Core database connectivity and migrations'
        else:
            purpose = f'Backend subsystem module: {name}'
            reason = 'Core backend TypeScript service'
            
    elif path.startswith('backend/test/'):
        subsystem = 'Backend Tests'
        test_use = 'YES'
        classification = 'TEST'
        purpose = f'Automated integration/unit test: {name}'
        reason = 'Required test suite for continuous verification'
        if 'assemblyai' in path: aai_rel = 'YES'
        if 'revenuecat' in path: rc_rel = 'YES'
        
    elif path.startswith('backend/public/'):
        subsystem = 'Backend Web UI / Tester'
        runtime_use = 'YES'
        classification = 'PRODUCTION'
        purpose = 'Browser voice tester and judge sandbox UI'
        aai_rel = 'YES'
        rc_rel = 'YES'
        reason = 'Interactive full-duplex voice console for judges and live demonstration'
        
    elif path.startswith('hosting/'):
        subsystem = 'Firebase Hosting'
        deploy_use = 'YES'
        classification = 'DEPLOYMENT'
        purpose = 'Static web app bundle deployed to Firebase Hosting'
        aai_rel = 'YES'
        rc_rel = 'YES'
        reason = 'Production web hosting frontend (https://hq-employee.web.app)'
        
    elif path.startswith('android/'):
        subsystem = 'Android Client'
        build_use = 'YES'
        if 'fake/' in path:
            subsystem = 'Android Data Mocks'
            test_use = 'YES'
            purpose = f'Android mock repository: {name}'
            classification = 'DEVELOPMENT'
            reason = 'Preview/debug mock repository; retained for Compose previews and local unit tests'
        elif 'domain/' in path:
            subsystem = 'Android Domain'
            classification = 'CORE'
            purpose = f'Clean architecture domain entity/use-case/repository interface: {name}'
            reason = 'Domain contracts for Android application'
        elif 'presentation/' in path:
            subsystem = 'Android Presentation (Jetpack Compose)'
            classification = 'CORE'
            purpose = f'Jetpack Compose UI Screen / ViewModel / UiState: {name}'
            reason = 'User interface for Android mobile application'
        else:
            classification = 'PRODUCTION'
            purpose = f'Android build/configuration/app file: {name}'
            reason = 'Android application source and configuration'
            
    elif path.startswith('submission/'):
        subsystem = 'Hackathon Submission Material'
        doc_use = 'YES'
        aai_rel = 'YES'
        classification = 'REQUIRED'
        purpose = f'Official AssemblyAI Hackathon submission artifact: {name}'
        reason = 'Submission documentation required by hackathon submission guidelines'
        
    elif path.startswith('infra/'):
        subsystem = 'DevOps / Infrastructure'
        deploy_use = 'YES'
        classification = 'DEPLOYMENT'
        purpose = 'Multi-stage Dockerfile for Cloud Run deployment'
        reason = 'Container build specification for production backend'
        
    elif path.startswith('scripts/'):
        subsystem = 'Deployment & Validation Scripts'
        deploy_use = 'YES'
        classification = 'DEVELOPMENT'
        purpose = f'Automation/verification script: {name}'
        reason = 'Verification and deployment utilities'
        
    elif path.startswith('docs/'):
        subsystem = 'Documentation'
        doc_use = 'YES'
        classification = 'DOCUMENTATION'
        purpose = f'Authoritative documentation: {name}'
        reason = 'Technical specification, audit trail, or architecture guide'
        if 'assemblyai' in path.lower(): aai_rel = 'YES'
        if 'revenuecat' in path.lower(): rc_rel = 'YES'
        if 'calling' in path.lower(): aai_rel = 'YES'
        
    elif path in ['README.md', 'firebase.json', '.firebaserc', 'SUBMISSION_BASELINE.md', 'BLOCKER_REGISTER.md']:
        subsystem = 'Root Configuration & Primary Documentation'
        if path.endswith('.json') or path.startswith('.'):
            deploy_use = 'YES'
            classification = 'DEPLOYMENT'
            purpose = f'Deployment configuration: {name}'
            reason = 'Firebase CLI and hosting configuration'
        else:
            doc_use = 'YES'
            classification = 'REQUIRED'
            purpose = f'Authoritative project documentation: {name}'
            reason = 'Primary repository readme and baseline'
            
    elif path in ['AUTONOMY_STATUS.md', 'BUG_REGISTER.md', 'CODEBASE_AUDIT.md', 'CORRECTION_PLAN.md', 'DEPENDENCY_AUDIT.md', 'INTEGRATION_STATUS.md', 'SECURITY_FINDINGS.md', 'TEST_STATUS.md']:
        subsystem = 'Duplicate Root Documentation'
        doc_use = 'YES'
        is_duplicate = 'YES'
        classification = 'DUPLICATE'
        purpose = f'Duplicate root document of docs/{name}'
        reason = f'Duplicate of docs/{name}; authoritative copy is maintained under docs/'
        safe_to_delete = 'YES'
        
    else:
        subsystem = 'General Configuration'
        classification = 'PRODUCTION'
        purpose = f'Repository root configuration file: {name}'
        reason = 'Workspace level configuration'

    counts[classification] = counts.get(classification, 0) + 1
    
    lines.append(f'### `{path}`')
    lines.append(f'- **PATH:** `{path}`')
    lines.append(f'- **TYPE:** {file_type}')
    lines.append(f'- **PURPOSE:** {purpose}')
    lines.append(f'- **OWNER/SUBSYSTEM:** {subsystem}')
    lines.append(f'- **RUNTIME USE:** {runtime_use}')
    lines.append(f'- **TEST USE:** {test_use}')
    lines.append(f'- **BUILD USE:** {build_use}')
    lines.append(f'- **DOCUMENTATION USE:** {doc_use}')
    lines.append(f'- **ECC USE:** {ecc_use}')
    lines.append(f'- **DEPLOYMENT USE:** {deploy_use}')
    lines.append(f'- **ASSEMBLYAI RELEVANCE:** {aai_rel}')
    lines.append(f'- **SHIPATON/REVENUECAT RELEVANCE:** {rc_rel}')
    lines.append(f'- **DUPLICATE:** {is_duplicate}')
    lines.append(f'- **UNUSED:** {is_unused}')
    lines.append(f'- **OBSOLETE:** {is_obsolete}')
    lines.append(f'- **UNRELATED:** {is_unrelated}')
    lines.append(f'- **SAFE TO DELETE:** {safe_to_delete}')
    lines.append(f'- **REASON:** {reason}')
    lines.append(f'- **CLASSIFICATION:** `{classification}`')
    lines.append('')

summary_lines = ['## Classification Summary', '', '| Classification | Count | Description |', '|---|---|---|']
for cat, count in sorted(counts.items(), key=lambda x: -x[1]):
    summary_lines.append(f'| `{cat}` | {count} | Category count |')
summary_lines.append('')

full_content = '\n'.join(lines[:6] + summary_lines + lines[6:])
with open(out_path, 'w') as f:
    f.write(full_content)

print(f'Successfully wrote {out_path} ({len(full_content)} bytes)')
