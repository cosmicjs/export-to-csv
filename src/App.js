import React, { useState, useEffect } from 'react';

import qs from 'qs';

import {
	toaster,
	Heading,
	Paragraph,
	Pane,
	Button,
	Spinner,
	SegmentedControl,
} from 'evergreen-ui';

import {
	fetchBucketData,
	generateCSVByObjectType,
	generateDOMDownload,
} from './helpers';

const {
	bucket_slug: bucketSlug,
	read_key: readKey,
} = qs.parse(window.location.href.split('?')[1] || '');

function App() {
	const [state, setState] = useState({
		didError: false,
		objectTypes: null,
		activeBuilds: {},
		limitStatus: false,
	});

	useEffect(() => {
		fetchBucketData(bucketSlug, readKey)
			.then(data => setState({ ...state, ...data }))
			.catch(error => setState({ didError: error }));
	}, []);

	if (state.didError) {
		return (
			<Pane
				display="flex"
				alignItems="center"
				justifyContent="center"
				height={480}
			>
				<Pane textAlign="center">
					<Heading size={800} marginBottom={12}>Could not load CSV extension.</Heading>
					<Paragraph>{state.didError.message}</Paragraph>
				</Pane>
			</Pane>
		)
	}

	if (!state.objectTypes) {
		return (
			<Pane
				display="flex"
				alignItems="center"
				justifyContent="center"
				height={480}
			>
				<Spinner size={64} />
			</Pane>
		)
	}

	const handleCSVGenerateClick = async (objectType) => {
		const updateBuildState = status => setState({
			...state,
			activeBuilds: {
				...state.activeBuilds,
				[objectType.slug]: status,	
			},
		});

		updateBuildState(true);
		try {
			const { csvData, total } = await generateCSVByObjectType(bucketSlug, readKey, objectType, state.limitStatus);
			toaster.success(`Generated ${objectType.slug} CSV, generated ${total} rows`);
			generateDOMDownload(`${bucketSlug}-${objectType.slug}-${new Date().toISOString()}.csv`, csvData);
		} catch (e) {
			console.error(e);
			toaster.danger(`Failed to generate ${objectType.slug} CSV. ${e.message}`);
		}
		updateBuildState(false);
	}

	return (
		<Pane
			padding={10}
		>
			<Heading
				size={900}
				marginBottom={20}
			>
				Export Objects to CSV
			</Heading>
			<Paragraph
				marginBottom={20}
			>
				Export your Cosmic JS Objects to CSV format based on Object Type.
				Metafields are based on the expected values found in the Bucket Object Settings.
				You can filter which Objects are in the report by status by selecting <b>Object status</b> below.
			</Paragraph>
			<Pane
				display="flex"
				borderRadius={3}
				marginBottom={12}
			>
				<Pane
					flex={1}
					alignItems="center"
					display="flex"
			>
					<Heading
						size={500}
					>
						Object status
					</Heading>
				</Pane>
				<Pane>
					<SegmentedControl
						width={240}
						options={[
							{ label: 'Published', value: 'published' },
							{ label: 'Draft', value: 'draft' },
							{ label: 'All', value: false },
						]}
						value={state.limitStatus}
						onChange={value => setState({
							...state,
							limitStatus: value,
						})}
					/>
				</Pane>
			</Pane>
			{state.objectTypes.map((objectType) => {
				const isBuildingCSV = state.activeBuilds && state.activeBuilds[objectType.slug];

				return (
					<Pane
						key={objectType.slug}
						display="flex"
						borderRadius={3}
						marginBottom={12}
					>
						<Pane
							flex={1}
							alignItems="center"
							display="flex"
						>
							<Heading
								size={600}
							>
								Export your {objectType.title}
							</Heading>
						</Pane>
						<Pane>
							<Button
								appearance="primary"
								intent="success"
								disabled={isBuildingCSV}
								onClick={() => handleCSVGenerateClick(objectType)}
							>
								{isBuildingCSV ? (
									<>
										<Spinner size={12} marginRight={8} />
										Generating CSV...
									</>
								) : 'Generate CSV'}
							</Button>
						</Pane>
					</Pane>
				);
			})}
		</Pane>
	);
}

export default App;
