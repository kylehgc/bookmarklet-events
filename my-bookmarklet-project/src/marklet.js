// This file contains the main logic for the bookmarklet. It scans the current page for events, interacts with the external LLM (likely Gemini Flash) to process the event data, and generates an ICS link for the user to add selected events to their calendar. It includes functions to handle event selection and modal display.
(function () {
	// Function to scan the current page for events
	function scanForEvents() {
		// Return the visible text content of the page
		return document.body.innerText;
	}

	// Function to call the external LLM and process event data
	async function processEvents(pageText) {
		const url = `http://localhost:3000/events`;

		try {
			const response = await fetch(url, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ html: pageText }),
			});

			if (!response.ok) {
				const errorText = await response.text();
				console.error('Error from local server:', response.status, errorText);
				alert(
					`Error processing events with local server: ${response.status} ${errorText}`,
				);
				return null;
			}

			const responseData = await response.json();
			console.log('Response from local server:', responseData);

			return responseData;
		} catch (error) {
			console.error('Error calling local server:', error);
			alert('Failed to call the local event processing service.');
			return null;
		}
	}

	// Function to generate ICS link for selected events
	function generateICS(events) {
		if (!events || events.length === 0) {
			alert('No events selected to generate ICS.');
			return null;
		}
		let icsContent =
			'BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//MyBookmarklet//EN\n';
		events.forEach((event) => {
			icsContent += `BEGIN:VEVENT\n`;
			icsContent += `UID:${new Date().getTime()}-${Math.random()
				.toString(36)
				.substr(2, 9)}@mybookmarklet\n`; // Basic UID
			icsContent += `DTSTAMP:${new Date()
				.toISOString()
				.replace(/[-:.]/g, '')}Z\n`;
			icsContent += `SUMMARY:${event.title || 'No Title'}\n`;

			if (event.date) {
				const year = parseInt(event.date.substring(0, 4), 10);
				const month = parseInt(event.date.substring(4, 6), 10) - 1; // JS month is 0-indexed
				const day = parseInt(event.date.substring(6, 8), 10);

				if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
					if (event.time) {
						// Event has a specific time
						const hour = parseInt(event.time.substring(0, 2), 10);
						const minute = parseInt(event.time.substring(2, 4), 10);
						const second = parseInt(event.time.substring(4, 6), 10);

						if (!isNaN(hour) && !isNaN(minute) && !isNaN(second)) {
							const startDate = new Date(
								Date.UTC(year, month, day, hour, minute, second),
							);
							icsContent += `DTSTART:${startDate
								.toISOString()
								.replace(/[-:.]/g, '')
								.slice(0, -4)}Z\n`;
							// Optional: Add DTEND for timed events, e.g., 1 hour later
							// const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
							// icsContent += `DTEND:${endDate.toISOString().replace(/[-:.]/g, '').slice(0, -4)}Z\n`;
						} else {
							console.warn(
								'Invalid time for event, treating as all-day:',
								event.title,
							);
							// Fallback to all-day if time is invalid
							const startDateObj = new Date(Date.UTC(year, month, day));
							const endDateObj = new Date(Date.UTC(year, month, day + 1));
							const formatDateToICSDate = (d) =>
								`${d.getUTCFullYear()}${(d.getUTCMonth() + 1)
									.toString()
									.padStart(2, '0')}${d
									.getUTCDate()
									.toString()
									.padStart(2, '0')}`;
							icsContent += `DTSTART;VALUE=DATE:${formatDateToICSDate(
								startDateObj,
							)}\n`;
							icsContent += `DTEND;VALUE=DATE:${formatDateToICSDate(
								endDateObj,
							)}\n`;
						}
					} else {
						// All-day event (time is missing)
						const startDateObj = new Date(Date.UTC(year, month, day));
						const endDateObj = new Date(Date.UTC(year, month, day + 1)); // For ICS, DTEND for all-day is exclusive
						const formatDateToICSDate = (d) =>
							`${d.getUTCFullYear()}${(d.getUTCMonth() + 1)
								.toString()
								.padStart(2, '0')}${d
								.getUTCDate()
								.toString()
								.padStart(2, '0')}`;
						icsContent += `DTSTART;VALUE=DATE:${formatDateToICSDate(
							startDateObj,
						)}\n`;
						icsContent += `DTEND;VALUE=DATE:${formatDateToICSDate(
							endDateObj,
						)}\n`;
					}
				} else {
					console.warn(
						'Could not parse date for event:',
						event.title,
						'. Using current time as fallback.',
					);
					icsContent += `DTSTART:${new Date()
						.toISOString()
						.replace(/[-:.]/g, '')
						.slice(0, -4)}Z\n`;
				}
			} else {
				// Fallback if date is missing entirely
				console.warn(
					'Missing date for event:',
					event.title,
					'. Using current time as fallback.',
				);
				icsContent += `DTSTART:${new Date()
					.toISOString()
					.replace(/[-:.]/g, '')
					.slice(0, -4)}Z\n`;
			}

			icsContent += `DESCRIPTION:${(
				event.description || 'No Description'
			).replace(/\n/g, '\\n')}\n`;
			icsContent += `END:VEVENT\n`;
		});
		icsContent += 'END:VCALENDAR';

		const blob = new Blob([icsContent], {
			type: 'text/calendar;charset=utf-8',
		});
		const url = URL.createObjectURL(blob);
		return url;
	}

	function generateGoogleCalendarLink(event, pageUrl) {
		if (!event || !event.title || !event.date) {
			console.warn(
				'Cannot generate Google Calendar link: missing event title or date',
				event,
			);
			return null;
		}

		let googleStartDateStr;
		let googleEndDateStr;

		const year = parseInt(event.date.substring(0, 4), 10);
		const month = parseInt(event.date.substring(4, 6), 10) - 1; // JS Date month is 0-indexed
		const day = parseInt(event.date.substring(6, 8), 10);

		const formatDateToGoogleDate = (dateObj) => {
			const y_ = dateObj.getUTCFullYear();
			const m_ = (dateObj.getUTCMonth() + 1).toString().padStart(2, '0');
			const d_ = dateObj.getUTCDate().toString().padStart(2, '0');
			return `${y_}${m_}${d_}`;
		};

		if (isNaN(year) || isNaN(month) || isNaN(day)) {
			console.warn(
				'Could not parse date for Google Calendar link. Using current day as fallback (all-day).',
				event.title,
			);
			const today = new Date();
			googleStartDateStr = formatDateToGoogleDate(today);
			const tomorrow = new Date(today);
			tomorrow.setDate(today.getDate() + 1);
			googleEndDateStr = formatDateToGoogleDate(tomorrow);
		} else if (event.time) {
			// Event has a specific time
			const hour = parseInt(event.time.substring(0, 2), 10);
			const minute = parseInt(event.time.substring(2, 4), 10);
			const second = parseInt(event.time.substring(4, 6), 10);

			if (isNaN(hour) || isNaN(minute) || isNaN(second)) {
				console.warn(
					'Invalid time for Google Calendar link, treating as all-day event for the given date.',
					event.title,
				);
				const startDateObj = new Date(Date.UTC(year, month, day));
				googleStartDateStr = formatDateToGoogleDate(startDateObj);
				const endDateObj = new Date(Date.UTC(year, month, day + 1));
				googleEndDateStr = formatDateToGoogleDate(endDateObj);
			} else {
				// Event has valid date and time
				const startDate = new Date(
					Date.UTC(year, month, day, hour, minute, second),
				);
				const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // Default 1 hour duration

				const formatToGoogleUTC = (dateObj) =>
					dateObj.toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z';
				googleStartDateStr = formatToGoogleUTC(startDate);
				googleEndDateStr = formatToGoogleUTC(endDate);
			}
		} else {
			// All-day event (date is present, time is missing)
			const startDateObj = new Date(Date.UTC(year, month, day));
			googleStartDateStr = formatDateToGoogleDate(startDateObj);
			const endDateObj = new Date(Date.UTC(year, month, day + 1)); // For Google all-day, end date is exclusive
			googleEndDateStr = formatDateToGoogleDate(endDateObj);
		}

		const taggedTitle = `[Bookmarklet-events] ${event.title || 'No Title'}`;
		const descriptionWithUrl = `Original URL: ${pageUrl}\n\n${
			event.description || ''
		}`;

		const baseUrl = 'https://www.google.com/calendar/render?action=TEMPLATE';
		const params = new URLSearchParams({
			text: taggedTitle,
			dates: `${googleStartDateStr}/${googleEndDateStr}`,
			details: descriptionWithUrl,
		});

		return `${baseUrl}&${params.toString()}`;
	}

	function displayEventSelectionModal(events, pageUrl) {
		// Remove existing modal if any
		const existingModal = document.getElementById('eventSelectionModal');
		if (existingModal) {
			existingModal.remove();
		}

		const modal = document.createElement('div');
		modal.id = 'eventSelectionModal';
		modal.style.position = 'fixed';
		modal.style.left = '50%';
		modal.style.top = '50%';
		modal.style.transform = 'translate(-50%, -50%)';
		modal.style.backgroundColor = 'white';
		modal.style.padding = '20px';
		modal.style.border = '1px solid #ccc';
		modal.style.zIndex = '10000';
		modal.style.maxHeight = '80vh';
		modal.style.overflowY = 'auto';
		modal.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)';

		const title = document.createElement('h2');
		title.innerText = 'Select Events to Add to Calendar';
		title.style.marginTop = '0';
		modal.appendChild(title);

		const form = document.createElement('form');
		form.style.padding = '16px';

		events.slice(0, 5).forEach((event, index) => {
			const label = document.createElement('label');
			label.style.display = 'block';
			label.style.marginBottom = '10px';
			label.style.padding = '10px';
			label.style.border = '1px solid #eee';
			label.style.borderRadius = '4px';

			const eventInfo = document.createElement('div');
			eventInfo.appendChild(
				document.createTextNode(
					`${event.title || 'No Title'} (Date: ${event.date || 'N/A'}, Time: ${
						event.time || 'N/A'
					})`,
				),
			);
			if (event.description) {
				const desc = document.createElement('p');
				desc.innerText = event.description;
				desc.style.fontSize = '0.9em';
				desc.style.color = '#555';
				eventInfo.appendChild(desc);
			}
			label.appendChild(eventInfo);

			const addThisEventButton = document.createElement('button');
			addThisEventButton.innerText = 'Add to Google Calendar';
			addThisEventButton.type = 'button';
			addThisEventButton.style.padding = '8px 12px';
			addThisEventButton.style.backgroundColor = '#4285F4';
			addThisEventButton.style.color = 'white';
			addThisEventButton.style.border = 'none';
			addThisEventButton.style.borderRadius = '4px';
			addThisEventButton.style.cursor = 'pointer';
			addThisEventButton.style.marginTop = '5px';
			addThisEventButton.onclick = function () {
				const googleLink = generateGoogleCalendarLink(event, pageUrl);
				if (googleLink) {
					window.open(googleLink, '_blank');
				} else {
					alert(
						`Could not generate Google Calendar link for event: ${event.title}`,
					);
				}
			};
			label.appendChild(addThisEventButton);
			form.appendChild(label);
		});
		modal.appendChild(form);

		const closeButton = document.createElement('button');
		closeButton.innerText = 'Close';
		closeButton.style.marginLeft = '10px';
		closeButton.style.padding = '10px 15px';
		closeButton.style.backgroundColor = '#6c757d';
		closeButton.style.color = 'white';
		closeButton.style.border = 'none';
		closeButton.style.borderRadius = '4px';
		closeButton.style.cursor = 'pointer';
		closeButton.onclick = function () {
			modal.remove();
		};
		modal.appendChild(closeButton);

		document.body.appendChild(modal);
	}

	// Function to handle event selection and modal display
	function handleEventSelection() {
		const pageText = scanForEvents();
		const currentPageUrl = window.location.href;
		if (!pageText || pageText.trim() === '') {
			alert('Could not retrieve page text content or content is empty.');
			return;
		}

		processEvents(pageText).then((processedEvents) => {
			if (
				!processedEvents ||
				!Array.isArray(processedEvents) ||
				processedEvents.length === 0
			) {
				alert(
					'No events found or processed by the local server, or the format is incorrect.',
				);
				return;
			}
			const validEvents = processedEvents.filter(
				(event) =>
					typeof event === 'object' &&
					event !== null &&
					event.title &&
					event.date &&
					event.time,
			);
			if (validEvents.length === 0) {
				alert(
					'No valid events with title, date, and time found in the response.',
				);
				console.log(
					"Received data that couldn't be parsed into valid events:",
					processedEvents,
				);
				return;
			}

			displayEventSelectionModal(validEvents, currentPageUrl);
		});
	}

	// Add a button to trigger the event selection
	const button = document.createElement('button');
	button.innerText = 'Add Events to Calendar';
	button.style.position = 'fixed';
	button.style.bottom = '20px';
	button.style.right = '20px';
	button.style.padding = '10px 20px';
	button.style.backgroundColor = '#28a745';
	button.style.color = 'white';
	button.style.border = 'none';
	button.style.borderRadius = '5px';
	button.style.zIndex = '9999';
	button.style.cursor = 'pointer';
	button.onclick = handleEventSelection;
	document.body.appendChild(button);
})();
