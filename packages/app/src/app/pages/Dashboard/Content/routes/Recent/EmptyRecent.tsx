import { EmptyPage } from 'app/pages/Dashboard/Components/EmptyPage';
import React from 'react';
import { useAppState } from 'app/overmind';
import { useWorkspaceAuthorization } from 'app/hooks/useWorkspaceAuthorization';
import { RecentHeader } from './RecentHeader';
import { DocumentationRow } from './DocumentationRow';
import { InstructionsRow } from './InstructionsRow';
import { OpenSourceRow } from './OpenSourceRow';

export const EmptyRecent: React.FC = () => {
  const { environment } = useAppState();
  const { isPrimarySpace } = useWorkspaceAuthorization();

  return (
    <EmptyPage.StyledWrapper
      css={{
        gap: '48px',
        height: 'auto',
        paddingBottom: '64px',
        marginTop: '28px',
      }}
    >
      <RecentHeader title="Let's start building" />
      {!environment.isOnPrem && <InstructionsRow />}
      {!environment.isOnPrem && <DocumentationRow />}
      {!environment.isOnPrem && isPrimarySpace ? <OpenSourceRow /> : null}
    </EmptyPage.StyledWrapper>
  );
};
