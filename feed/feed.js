(function() {

	var always = bilby.constant;
	var curry = bilby.curry;

	var has = curry(function(o, attr) {
		return o.hasOwnProperty(attr);
	});

	var hasAll = curry(function(attrs, o) {
		return attrs.every(has(o));
	});

	var feedTypes = [
		// Status update
		{
			condition: hasAll(['status_update', 'posted_by']),
			template: '<section><h1>{{posted_by}} updated his status: {{status_update}}</h1></section>'
		},
		// New image
		{
			condition: hasAll(['new_image', 'posted_by']),
			template: '<section><h1>{{posted_by}} posted a new image.</h1><p><img src="{{new_image}}" /></p>{{#description}}<p>{{description}}</p>{{/description}}</section>'
		},
		// Fallback
		{
			condition: always(true),
			template: '{{#fallback}}{{#text}}<section><h1>{{text}}</h1></section>{{/text}}{{/fallback}}'
		}
	];

	var render = curry(Mustache.to_html);

	var makeMethod = function(env, type) {
		return env.method('html', type.condition, render(type.template));
	};

	var feedMaker = feedTypes.reduce(makeMethod, bilby.environment());

	var addToFeed = function(data) { $("#feed").append(data.posts.map(feedMaker.html)); };

	var data_url = '/feed/data/feed.json'; // Test feed with only known types
	//var data_url = '/feed/data/feed2.json'; // Another test feed with a new unknown feed item type
	var request = $.getJSON(data_url, addToFeed);
})();