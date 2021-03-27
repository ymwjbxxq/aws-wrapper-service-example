# AWS WRAPPERS #

When you have many Lambda functions, you will find yourself writing the same code a few times. Instead of doing that, you should write a private package that you could share around your applications.

### WHAT TO KNOW? ###

I wanted to show just a few examples of wrapper SQS and [Kinesis]( https://bitbucket.org/DanBranch/kinesis/src/master/). 
I have picked those two because you should use the batch operations that AWS SDK has.
Once you start using batch operations, a common mistake is to believe that AWS SDK will ensure that every single item in the batch will be successfully delivered. In reality, AWS SDK retries the request on your behalf if the service is unavailable or another 5xx error.
 
### PARTIAL FAILURE ###

The batch request will go through successfully, and if you check the output result of AWS SQS and AWS Kinesis, you will see that you have a reference to failed records, which means that part of your records could not be delivered. If you are not looking at this result, you could lose precious data.

### SOLUTION ###

No matter what you will do, you will have some failure, so you should try to handle this failure somehow. In the code of this repository, you can find a basic retry scenario with a delay between requests and, hopefully, it is enough to get you started.

### WHAT IS MISSING ###

If you arrive and the end of your retries attempts and there are still failures, I think you should save them in a DLQ.
