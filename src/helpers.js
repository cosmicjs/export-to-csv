
export async function fetchBucketData(bucketSlug, readKey) {
	const { object_types: objectTypes, ...res } = await fetch(
		`https://api.cosmicjs.com/v1/${bucketSlug}/object-types?read_key=${readKey}`
	).then(res => res.json());

	if (res.error) {
		throw new Error(res.error);
	}

	return { objectTypes };
}

// serialize a JS array to a valid CSV string
const arrayToCSVRowString = array => array
	.map(item => '"' + (`${item}`
		// escape quotes
		.replace(/"/g, '""')
		// escape commas
		.replace(/,/g, '\,')) + '"')
	.join(',');

// generate CSV heading row
const mapCosmicObjectToCSVHeading = (expectedKeys, expectedMetafields) => 
	arrayToCSVRowString([
		...expectedKeys,
		// remap metafield slugs to dot.path equivalent
		...expectedMetafields.map(key => `metadata.${key}`),
	]);

// mutative function for sanitizing and generating a basic CSV row
function mapCosmicObjectToCSVRow(cosmicObject, expectedKeys, expectedMetafields) {
	// get root level Cosmic node values as array (in same order as expectedKeys)
	const rowValues = expectedKeys.map(key => cosmicObject[key]);

	// attempt to get metadata values (if present) and append to values
	const metadata = cosmicObject.metadata || {};
	expectedMetafields.forEach(key => rowValues.push(metadata[key] || null));

	// return CSV safe row
	return arrayToCSVRowString(rowValues);
}

export async function generateCSVByObjectType(bucketSlug, readKey, objectType, limitStatus) {
	const limit = 128;

	const filterByStatus = o => !limitStatus || o.state === limitStatus;

	const generateQuery = (page = 0) =>
		`https://api.cosmicjs.com/v1/${bucketSlug}/objects?type=${
			objectType.slug}&limit=${limit}&skip=${limit * page}${
			limitStatus ? `&status=${limitStatus}` : ''}&read_key=${readKey}`;

	// derive expected metafields from the objectType provided
	const expectedMetafields = objectType.metafields ?
		objectType.metafields.map(({ key }) => key) : [];

	// fetch the initial dataset for the node. Use as iteratee to determine
	// pagination state
	let responseData = await fetch(generateQuery()).then(res => res.json());

	if (!responseData.objects || !responseData.objects.length) {
		// no objects, no parse.
		throw new Error(responseData.error || responseData.message || 'No objects returned');
	}

	// determine the expected keys from the first object returned
	const expectedKeys = Object.keys(responseData.objects[0])
		// purge any unwanted keys from heading (metadata should always be omitted!)
		.filter(key => !['_id', 'metafields', 'metadata'].includes(key));

	// row mapping mutates the source object so building heading after rows
	const heading = mapCosmicObjectToCSVHeading(expectedKeys, expectedMetafields)

	// generate initial rows
	const rows = responseData.objects
		.filter(filterByStatus)
		.map(o => mapCosmicObjectToCSVRow(o, expectedKeys, expectedMetafields));

	let pageIndex = 1;

	// perform fetches until page object count is less than limit
	while (responseData.objects && rows.length !== responseData.total) {
		responseData = await fetch(generateQuery(pageIndex))
			.then(res => res.json());
			
		if (!responseData.objects) {
			continue;
		}

		// append CSV rows
		rows.push(...responseData.objects
			.filter(filterByStatus)
			.map(o => mapCosmicObjectToCSVRow(o, expectedKeys, expectedMetafields))
		);

		pageIndex += 1;
	}

	if (!rows.length) {
		throw new Error(`Not enough ${objectType.title} of specified status to build CSV`);
	}

	return { csvData: heading + '\n' + rows.join('\n'), total: rows.length };
}

// adapted from https://stackoverflow.com/a/33542499/10532549
export function generateDOMDownload(filename, data) {
	const blob = new Blob([data], { type: 'text/csv' });
	if (window.navigator.msSaveOrOpenBlob) {
		window.navigator.msSaveBlob(blob, filename);
	} else{
		const elem = window.document.createElement('a');
		elem.href = window.URL.createObjectURL(blob);
		elem.download = filename;
		document.body.appendChild(elem);
		elem.click();
		document.body.removeChild(elem);
	}
}