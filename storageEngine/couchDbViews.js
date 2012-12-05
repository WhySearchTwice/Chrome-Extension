{
    "_id": "_design/pageView",
    "language": "javascript",
    "views": {
        "all": {
            "map": "function(doc) { if (doc.type == 'pageView')  emit(null, doc) }"
        },
        "by_userId": {
            "map": "function(doc) { if (doc.type == 'pageView' && doc.userId != null)  emit(doc.userId, doc) }"
        },
        "null_userId": {
            "map": "function(doc) { if (doc.type == 'pageView' && doc.userId == null)  emit(doc.null, doc) }"
        }
    }
}

{
   "_id": "_design/focusChange",
   "language": "javascript",
   "views": {
       "all": {
           "map": "function(doc) { if (doc.type == 'focusChange')  emit(null, doc) }"
       },
       "by_userId": {
           "map": "function(doc) { if (doc.type == 'focusChange' && doc.userId != null)  emit(doc.userId, doc) }"
       },
       "null_userId": {
           "map": "function(doc) { if (doc.type == 'focusChange' && doc.userId == null)  emit(doc.null, doc) }"
       }
   }
}

{
    "_id": "_design/stats",
    "language": "javascript",
    "views": {
        "hitCountByUrl": {
            "map": "function(doc) { if (doc.type == 'pageView')  emit(doc.pageUrl, 1) }",
            "reduce": "function(key, values, rereduce) { return sum(values) }"
        }
    }
}
