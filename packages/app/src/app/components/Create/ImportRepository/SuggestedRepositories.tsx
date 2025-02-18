import React, { useEffect, useMemo, useState } from 'react';
import formatDistanceStrict from 'date-fns/formatDistanceStrict';
import { zonedTimeToUtc } from 'date-fns-tz';
import styled from 'styled-components';
import VisuallyHidden from '@reach/visually-hidden';
import { Link as RouterLink } from 'react-router-dom';

import {
  Stack,
  Text,
  Icon,
  InteractiveOverlay,
  AnimatingDots,
  SkeletonText,
  Link,
} from '@codesandbox/components';
import track from '@codesandbox/common/lib/utils/analytics';

import { useActions, useAppState } from 'app/overmind';
import { useGitHubPermissions } from 'app/hooks/useGitHubPermissions';
import { useWorkspaceSubscription } from 'app/hooks/useWorkspaceSubscription';
import { useGithubAccounts } from 'app/hooks/useGithubOrganizations';
import { useGitHubAccountRepositories } from 'app/hooks/useGitHubAccountRepositories';
import { fuzzyMatchGithubToCsb } from 'app/utils/fuzzyMatchGithubToCsb';

import { AccountSelect } from './AccountSelect';
import { AuthorizeForSuggested } from './AuthorizeForSuggested';

type SuggestedRepositoriesProps = {
  isImportOnly?: boolean;
};
export const SuggestedRepositories = ({
  isImportOnly,
}: SuggestedRepositoriesProps) => {
  const {
    activeTeamInfo,
    dashboard: { repositoriesByTeamId },
  } = useAppState();
  const { modalClosed, dashboard: dashboardActions } = useActions();
  const { restrictsPrivateRepos } = useGitHubPermissions();
  const { isFree, isEligibleForTrial } = useWorkspaceSubscription();
  const [importsInProgress, setImportsInProgress] = useState<
    Array<{ owner: string; name: string }>
  >([]);
  const [importsDone, setImportsDone] = useState<
    Array<{ owner: string; name: string }>
  >([]);

  const teamId = activeTeamInfo?.id;

  const importedRepos = useMemo(() => {
    if (!teamId) {
      return undefined;
    }

    return repositoriesByTeamId[teamId];
  }, [teamId, repositoriesByTeamId]);

  const [selectedAccount, setSelectedAccount] = useState<string | undefined>();
  const githubAccounts = useGithubAccounts();

  const selectOptions = useMemo(
    () =>
      githubAccounts.data && githubAccounts.data.personal
        ? [
            githubAccounts.data.personal,
            ...(githubAccounts.data.organizations || []),
          ]
        : undefined,
    [githubAccounts.data]
  );

  useEffect(() => {
    // Set initially selected account bazed on fuzzy matching
    if (
      githubAccounts.state === 'ready' &&
      // Adding selectOptions to this if statement to satisfy TypeScript, because it does not
      // know that when githubAccounts.state !== 'ready' the fuzzy functions isn't executed.
      selectOptions &&
      activeTeamInfo?.name &&
      selectedAccount === undefined
    ) {
      const match = fuzzyMatchGithubToCsb(activeTeamInfo.name, selectOptions);

      setSelectedAccount(match.login);
    }
  }, [githubAccounts.state, selectedAccount, activeTeamInfo, selectOptions]);

  useEffect(() => {
    // This is needed if the import is opened before the user
    // visits the repositories page.
    if (!importedRepos && teamId) {
      dashboardActions.getRepositoriesByTeam({
        teamId,
        fetchCachedDataFirst: true,
      });
    }
  }, []);

  // eslint-disable-next-line no-nested-ternary
  const selectedAccountType = selectedAccount
    ? selectedAccount === githubAccounts?.data?.personal?.login
      ? 'personal'
      : 'organization'
    : undefined;

  const githubRepos = useGitHubAccountRepositories({
    name: selectedAccount,
    accountType: selectedAccountType,
    teamRepos: importedRepos,
  });

  if (githubAccounts.state === 'loading') {
    return <SkeletonText />;
  }

  return githubAccounts.state === 'ready' && selectedAccount ? (
    <Stack
      direction="vertical"
      gap={4}
      css={{
        fontFamily: 'Inter',
        marginBottom: '16px',
        fontWeight: 500,
        // Conditionally spreading an object doesn't work for some reason so
        // I had to move the conditional to separate properties.
        maxHeight: isImportOnly ? '300px' : undefined,
        overflow: isImportOnly ? 'auto' : undefined,
      }}
    >
      <Stack justify="space-between" css={{ fontSize: '13px' }}>
        <AccountSelect
          options={selectOptions}
          value={selectedAccount}
          onChange={(account: string) => {
            track('Suggested repos - change account', {
              codesandbox: 'V1',
              event_source: 'UI',
            });

            setSelectedAccount(account);
          }}
        />
      </Stack>

      {githubRepos.state === 'loading' ? (
        <StyledList direction="vertical" gap={1}>
          <SkeletonText css={{ height: '64px', width: '100%' }} />
          <SkeletonText css={{ height: '64px', width: '100%' }} />
          <SkeletonText css={{ height: '64px', width: '100%' }} />
        </StyledList>
      ) : null}

      {githubRepos.state === 'ready' ? (
        <>
          <StyledList as="ul" direction="vertical" gap={1}>
            {githubRepos.data?.map(repo => {
              const repoIsImporting = !!importsInProgress.find(
                iip => iip.owner === repo.owner.login && iip.name === repo.name
              );

              const repoWasImported = !!importsDone.find(
                iip => iip.owner === repo.owner.login && iip.name === repo.name
              );

              const disableActions = repoIsImporting || repoWasImported;

              return (
                <InteractiveOverlay key={repo.id}>
                  <StyledItem
                    isDisabled={isFree && repo.private}
                    alwaysShowIndicator={disableActions}
                  >
                    <Stack gap={4} align="center">
                      <Icon name="repository" color="#999999B3" />
                      {isFree && repo.private ? (
                        <Text size={13} variant="muted">
                          {repo.name}
                        </Text>
                      ) : (
                        <InteractiveOverlay.Button
                          onClick={async () => {
                            const repoInfo = {
                              owner: repo.owner.login,
                              name: repo.name,
                            };

                            setImportsInProgress(prev => [...prev, repoInfo]);

                            const isPersonalRepository =
                              repo.owner.login ===
                              githubAccounts?.data?.personal?.login;

                            if (isPersonalRepository) {
                              track(
                                `Suggested repos ${
                                  isImportOnly
                                    ? 'create team modal'
                                    : 'create new modal'
                                } - Imported personal repository into team space`,
                                {
                                  codesandbox: 'V1',
                                  event_source: 'UI',
                                }
                              );
                            } else {
                              track(
                                `Suggested repos ${
                                  isImportOnly
                                    ? 'create team modal'
                                    : 'create new modal'
                                } - Imported organization repository into team space`,
                                {
                                  codesandbox: 'V1',
                                  event_source: 'UI',
                                }
                              );
                            }

                            const importResult = await dashboardActions.importGitHubRepository(
                              {
                                ...repoInfo,
                                redirect: !isImportOnly,
                              }
                            );

                            // Remove the repo from the in progress list
                            setImportsInProgress(prev =>
                              prev.filter(
                                r =>
                                  r.owner !== repoInfo.owner &&
                                  r.name !== repoInfo.name
                              )
                            );

                            // Add the repo into the done list
                            if (importResult) {
                              setImportsDone(prev => [...prev, repoInfo]);
                            }
                          }}
                          disabled={disableActions}
                        >
                          <VisuallyHidden>Import</VisuallyHidden>
                          <Text size={13}>{repo.name}</Text>
                        </InteractiveOverlay.Button>
                      )}
                      {repo.private ? (
                        <>
                          <VisuallyHidden>Private repository</VisuallyHidden>
                          <Icon name="lock" color="#999999" />
                        </>
                      ) : null}
                      {repo.pushedAt ? (
                        <Text size={13} color="#999999B3">
                          <VisuallyHidden>Last updated</VisuallyHidden>
                          {formatDistanceStrict(
                            zonedTimeToUtc(repo.pushedAt, 'Etc/UTC'),
                            new Date(),
                            {
                              addSuffix: true,
                            }
                          )}
                        </Text>
                      ) : null}
                    </Stack>
                    {isFree && repo.private ? (
                      <StyledIndicator>
                        <InteractiveOverlay.Item>
                          <Link
                            as={RouterLink}
                            to="/pro"
                            onClick={() => {
                              track(
                                'Suggested repos - Upgrade to Pro from private repo',
                                {
                                  codesandbox: 'V1',
                                  event_source: 'UI',
                                }
                              );
                              modalClosed();
                            }}
                          >
                            <Text
                              size={12}
                              css={{
                                display: 'block',
                                width: 152,
                                color: '#999999B3',
                              }}
                              align="right"
                            >
                              <VisuallyHidden>
                                {repo.name} is a private repository.
                              </VisuallyHidden>
                              <Text color="#C2C2C2">
                                {isEligibleForTrial
                                  ? 'Start a free trial '
                                  : 'Upgrade to Pro '}
                              </Text>
                              to import private repositories.
                            </Text>
                          </Link>
                        </InteractiveOverlay.Item>
                      </StyledIndicator>
                    ) : (
                      <StyledIndicator aria-hidden>
                        <StyledImportIndicator>
                          {disableActions && repoIsImporting && (
                            <AnimatingDots />
                          )}
                          {disableActions && repoWasImported && (
                            <Icon name="simpleCheck" />
                          )}
                          {!disableActions && <>Import</>}
                        </StyledImportIndicator>
                      </StyledIndicator>
                    )}
                  </StyledItem>
                </InteractiveOverlay>
              );
            })}
          </StyledList>
          {restrictsPrivateRepos ? <AuthorizeForSuggested /> : null}
        </>
      ) : null}
    </Stack>
  ) : null;
};

const StyledList = styled(Stack)`
  margin: 0;
  padding: 0;
  list-style: none;
`;

const StyledIndicator = styled.span`
  opacity: 0;
`;

const StyledItem = styled.li<{
  isDisabled?: boolean;
  alwaysShowIndicator?: boolean;
}>`
  display: flex;
  justify-content: space-between;
  padding: 16px;
  background-color: #1d1d1d;
  border-radius: 4px;
  height: 32px;
  align-items: center;

  ${StyledIndicator} {
    opacity: ${({ alwaysShowIndicator }) => (alwaysShowIndicator ? 1 : 0)};
  }

  &:hover,
  &:focus-within {
    ${({ isDisabled }) =>
      !isDisabled &&
      `
        background-color: #252525;
      `}

    ${StyledIndicator} {
      opacity: 1;
    }
  }
`;

const StyledImportIndicator = styled.span`
  box-sizing: border-box;
  height: 100%;
  width: 100%;
  display: flex;
  padding: 8px;
  color: #c2c2c2;
  font-size: 12px;
  text-align: center;
`;
